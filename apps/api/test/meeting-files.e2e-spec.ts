import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import type { StorageEnv } from './../src/config/storage-env.js';

type MeetingFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: string;
  status: string;
  createdAt: string;
};
type CreatedUpload = {
  file: MeetingFile;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
};

const MEETING = {
  title: 'Design review',
  date: '2026-10-01T10:00:00.000Z',
  participants: ['alice@example.com'],
};
const AUDIO = Buffer.from('ID3 not really an mp3, but storage does not care');

describe('Meeting files (e2e)', () => {
  let app: INestApplication<App>;
  let s3: S3Client;
  let bucket: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Writes objects behind the API's back, to fake a tampered upload.
    const config = app.get<ConfigService<StorageEnv, true>>(ConfigService);
    bucket = config.get('S3_BUCKET', { infer: true });
    s3 = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
    });
  });

  afterAll(async () => {
    s3.destroy();
    await app.close();
  });

  // A fresh user per test, so meetings and their file limits never collide.
  async function signUp(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `user-${randomUUID()}@example.com`, password: 'correct-horse-battery' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function createMeeting(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/meetings')
      .auth(token, { type: 'bearer' })
      .send(MEETING)
      .expect(201);
    return (res.body as { id: string }).id;
  }

  const createFile = (token: string, meetingId: string, body: object) =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .auth(token, { type: 'bearer' })
      .send(body);
  const complete = (token: string, meetingId: string, fileId: string) =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files/${fileId}/complete`)
      .auth(token, { type: 'bearer' });
  const getMeeting = (token: string, meetingId: string) =>
    request(app.getHttpServer()).get(`/meetings/${meetingId}`).auth(token, { type: 'bearer' });

  async function createdUpload(
    token: string,
    meetingId: string,
    body: object = { name: 'standup.mp3', mimeType: 'audio/mpeg', size: AUDIO.length },
  ): Promise<CreatedUpload> {
    const res = await createFile(token, meetingId, body).expect(201);
    return res.body as CreatedUpload;
  }

  // What the browser does: PUT the bytes straight to storage.
  const put = (upload: CreatedUpload, bytes: Buffer, headers = upload.uploadHeaders) =>
    fetch(upload.uploadUrl, { method: 'PUT', headers, body: new Uint8Array(bytes) });

  // The object key, read back from the presigned URL's path: /<bucket>/<key>.
  const storageKey = (upload: CreatedUpload) =>
    decodeURIComponent(new URL(upload.uploadUrl).pathname.split('/').slice(2).join('/'));

  describe('authentication', () => {
    it.each([
      [
        'POST /meetings/:id/files',
        (id: string) => request(app.getHttpServer()).post(`/meetings/${id}/files`),
      ],
      [
        'POST /meetings/:id/files/:fileId/complete',
        (id: string) =>
          request(app.getHttpServer()).post(`/meetings/${id}/files/${randomUUID()}/complete`),
      ],
    ])('%s rejects a request without a token', async (_route, send) => {
      await send(randomUUID()).expect(401);
    });
  });

  describe('upload flow', () => {
    it('creates a file, accepts the bytes in storage and queues it on complete', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);

      const upload = await createdUpload(token, meetingId);
      const { id, createdAt, ...described } = upload.file;
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(Date.parse(createdAt)).not.toBeNaN();
      expect(described).toEqual({
        name: 'standup.mp3',
        mimeType: 'audio/mpeg',
        size: AUDIO.length,
        kind: 'RECORDING',
        status: 'PENDING_UPLOAD',
      });
      expect(upload.uploadHeaders).toEqual({ 'Content-Type': 'audio/mpeg' });
      expect(storageKey(upload)).toMatch(new RegExp(`^meetings/${meetingId}/[0-9a-f-]{36}$`));
      expect(new URL(upload.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('3600');

      // Pending files are in flight and not listed yet.
      expect((await getMeeting(token, meetingId).expect(200)).body).toMatchObject({ files: [] });

      expect((await put(upload, AUDIO)).status).toBe(200);
      const res = await complete(token, meetingId, upload.file.id).expect(200);
      expect(res.body).toEqual({ ...upload.file, status: 'QUEUED' });

      const meeting = await getMeeting(token, meetingId).expect(200);
      expect((meeting.body as { files: MeetingFile[] }).files).toEqual([
        { ...upload.file, status: 'QUEUED' },
      ]);
    });

    it('answers complete again with the queued file', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      await put(upload, AUDIO);
      await complete(token, meetingId, upload.file.id).expect(200);

      const again = await complete(token, meetingId, upload.file.id).expect(200);
      expect((again.body as MeetingFile).status).toBe('QUEUED');
    });

    it('classifies transcripts and fills in a missing type from the extension', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId, {
        name: 'C:\\fakepath\\captions.srt',
        mimeType: '',
        size: 42,
      });
      expect(upload.file).toMatchObject({
        name: 'captions.srt',
        mimeType: 'application/x-subrip',
        kind: 'TRANSCRIPT',
      });
      expect(upload.uploadHeaders).toEqual({ 'Content-Type': 'application/x-subrip' });
    });

    it('leaves GET /meetings without files', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      await put(upload, AUDIO);
      await complete(token, meetingId, upload.file.id).expect(200);

      const list = await request(app.getHttpServer())
        .get('/meetings')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(Object.keys((list.body as object[])[0]).sort()).toEqual([
        'date',
        'id',
        'participants',
        'title',
      ]);
    });

    it('lets storage refuse a PUT with a different Content-Type', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      expect((await put(upload, AUDIO, { 'Content-Type': 'video/mp4' })).status).toBe(403);
    });
  });

  describe('validation on create', () => {
    let token: string;
    let meetingId: string;
    beforeAll(async () => {
      token = await signUp();
      meetingId = await createMeeting(token);
    });

    it.each([
      [
        'a type outside the allow-list',
        { name: 'slides.pdf', mimeType: 'application/pdf', size: 10 },
      ],
      ['a name without an extension', { name: 'recording', mimeType: 'audio/mpeg', size: 10 }],
      [
        'a type that does not match the extension',
        { name: 'song.mp3', mimeType: 'video/mp4', size: 10 },
      ],
      ['an empty file', { name: 'standup.mp3', mimeType: 'audio/mpeg', size: 0 }],
      ['a file over 1 GB', { name: 'standup.mp3', mimeType: 'audio/mpeg', size: 1024 ** 3 + 1 }],
      ['a fractional size', { name: 'standup.mp3', mimeType: 'audio/mpeg', size: 10.5 }],
      ['a blank name', { name: '   ', mimeType: 'audio/mpeg', size: 10 }],
      ['a missing mimeType', { name: 'standup.mp3', size: 10 }],
      [
        'an unknown field',
        { name: 'standup.mp3', mimeType: 'audio/mpeg', size: 10, kind: 'TRANSCRIPT' },
      ],
    ])('rejects %s with 400', async (_case, body) => {
      await createFile(token, meetingId, body).expect(400);
    });

    it('accepts exactly 1 GB', async () => {
      await createFile(token, meetingId, {
        name: 'all-hands.mp4',
        mimeType: 'video/mp4',
        size: 1024 ** 3,
      }).expect(201);
    });
  });

  describe('file limit', () => {
    it('allows 10 files per meeting and answers 409 for the 11th', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      for (let i = 0; i < 10; i++) {
        await createdUpload(token, meetingId, {
          name: `part-${i}.mp3`,
          mimeType: 'audio/mpeg',
          size: 10,
        });
      }
      const res = await createFile(token, meetingId, {
        name: 'part-10.mp3',
        mimeType: 'audio/mpeg',
        size: 10,
      }).expect(409);
      expect((res.body as { message: string }).message).toMatch(/up to 10 files/);
    });
  });

  describe('validation on complete', () => {
    it('answers 409 while the object is not in storage', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      await complete(token, meetingId, upload.file.id).expect(409);
    });

    it('answers 409 when the stored size differs from the declared one', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId, {
        name: 'standup.mp3',
        mimeType: 'audio/mpeg',
        size: AUDIO.length + 100,
      });
      await put(upload, AUDIO);
      const res = await complete(token, meetingId, upload.file.id).expect(409);
      expect((res.body as { message: string }).message).toMatch(/bytes/);
    });

    it('answers 409 when the stored type differs from the declared one', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey(upload),
          Body: AUDIO,
          ContentType: 'video/mp4',
        }),
      );
      await complete(token, meetingId, upload.file.id).expect(409);
    });

    it('keeps a rejected file pending and out of the meeting', async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      await complete(token, meetingId, upload.file.id).expect(409);
      expect((await getMeeting(token, meetingId).expect(200)).body).toMatchObject({ files: [] });
    });
  });

  describe('ownership', () => {
    it("answers 404 for another user's meeting and file", async () => {
      const owner = await signUp();
      const stranger = await signUp();
      const meetingId = await createMeeting(owner);
      const upload = await createdUpload(owner, meetingId);
      await put(upload, AUDIO);

      await createFile(stranger, meetingId, {
        name: 'standup.mp3',
        mimeType: 'audio/mpeg',
        size: 10,
      }).expect(404);
      await complete(stranger, meetingId, upload.file.id).expect(404);
      // Still pending: the stranger's call changed nothing.
      await complete(owner, meetingId, upload.file.id).expect(200);
    });

    it("answers 404 for a file reached through another of the owner's meetings", async () => {
      const token = await signUp();
      const meetingId = await createMeeting(token);
      const otherMeetingId = await createMeeting(token);
      const upload = await createdUpload(token, meetingId);
      await complete(token, otherMeetingId, upload.file.id).expect(404);
    });

    it.each([
      ['a malformed meeting id', 'not-a-uuid'],
      ['a missing meeting', randomUUID()],
    ])('answers 404 for %s', async (_case, meetingId) => {
      const token = await signUp();
      await createFile(token, meetingId, {
        name: 'standup.mp3',
        mimeType: 'audio/mpeg',
        size: 10,
      }).expect(404);
    });

    it.each(['not-a-uuid', randomUUID()])(
      'answers 404 on complete for file id %s',
      async (fileId) => {
        const token = await signUp();
        const meetingId = await createMeeting(token);
        await complete(token, meetingId, fileId).expect(404);
      },
    );
  });
});
