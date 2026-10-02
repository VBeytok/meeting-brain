import { randomUUID } from 'node:crypto';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import type { StorageEnv } from './../src/config/storage-env.js';
import { CleanUpAbandonedUploadsCommand } from './../src/meeting-files/commands/clean-up-abandoned-uploads/clean-up-abandoned-uploads.command.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// The fakes answer at once, whatever .env says.
process.env.ASSEMBLYAI_API_KEY = '';
process.env.FAKE_TRANSCRIPTION_DELAY_SECONDS = '0';
process.env.ANTHROPIC_API_KEY = '';
process.env.FAKE_ANALYSIS_DELAY_SECONDS = '0';

const HOUR = 60 * 60 * 1000;
const BYTES = Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi.');

type CreatedUpload = {
  file: { id: string };
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
};

describe('Abandoned upload cleanup (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let commandBus: CommandBus;
  let s3: S3Client;
  let bucket: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    commandBus = app.get(CommandBus);

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

  async function signUpAndCreateMeeting(): Promise<{ token: string; meetingId: string }> {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `user-${randomUUID()}@example.com`, password: 'correct-horse-battery' })
      .expect(201);
    const token = (register.body as { accessToken: string }).accessToken;
    const meeting = await request(app.getHttpServer())
      .post('/meetings')
      .auth(token, { type: 'bearer' })
      .send({ title: 'Cleanup', date: '2026-10-01T10:00:00.000Z', participants: [] })
      .expect(201);
    return { token, meetingId: (meeting.body as { id: string }).id };
  }

  // Registers a transcript upload and, with `bytes`, PUTs them to storage.
  async function register(token: string, meetingId: string, withBytes: boolean) {
    const res = await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'notes.vtt', mimeType: 'text/vtt', size: BYTES.length })
      .expect(201);
    const upload = res.body as CreatedUpload;
    if (withBytes) {
      const put = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.uploadHeaders,
        body: new Uint8Array(BYTES),
      });
      expect(put.status).toBe(200);
    }
    const row = await prisma.meetingFile.findUniqueOrThrow({ where: { id: upload.file.id } });
    return { id: upload.file.id, key: row.storageKey };
  }

  // Pretends the file was registered `hours` ago.
  const age = (id: string, hours: number) =>
    prisma.meetingFile.update({
      where: { id },
      data: { createdAt: new Date(Date.now() - hours * HOUR) },
    });

  const exists = (key: string) =>
    s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(
      () => true,
      () => false,
    );
  const rowExists = async (id: string) => (await prisma.meetingFile.count({ where: { id } })) === 1;

  const cleanUp = (now?: Date) => commandBus.execute(new CleanUpAbandonedUploadsCommand(now));

  it('removes an upload abandoned for 25 hours, with its object, and keeps the rest', async () => {
    const { token, meetingId } = await signUpAndCreateMeeting();

    const abandoned = await register(token, meetingId, true);
    const abandonedNoBytes = await register(token, meetingId, false);
    const recent = await register(token, meetingId, true);
    const confirmed = await register(token, meetingId, true);
    await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files/${confirmed.id}/complete`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    await prisma.meetingFile.update({ where: { id: confirmed.id }, data: { status: 'READY' } });

    await age(abandoned.id, 25);
    await age(abandonedNoBytes.id, 25);
    await age(recent.id, 1);
    await age(confirmed.id, 25);

    expect(await cleanUp()).toBeGreaterThanOrEqual(2);

    // Gone: row and object (or no object to begin with).
    expect(await rowExists(abandoned.id)).toBe(false);
    expect(await exists(abandoned.key)).toBe(false);
    expect(await rowExists(abandonedNoBytes.id)).toBe(false);
    // Kept: a recent pending upload, and a file in any other status however old.
    expect(await rowExists(recent.id)).toBe(true);
    expect(await exists(recent.key)).toBe(true);
    expect(await rowExists(confirmed.id)).toBe(true);
    expect(await exists(confirmed.key)).toBe(true);
  });

  it('judges age by the clock it is given', async () => {
    const { token, meetingId } = await signUpAndCreateMeeting();
    const file = await register(token, meetingId, true);

    await cleanUp(new Date(Date.now() + 23 * HOUR));
    expect(await rowExists(file.id)).toBe(true);

    await cleanUp(new Date(Date.now() + 25 * HOUR));
    expect(await rowExists(file.id)).toBe(false);
    expect(await exists(file.key)).toBe(false);
  });

  it('frees the upload slots of a meeting', async () => {
    const { token, meetingId } = await signUpAndCreateMeeting();
    const file = await register(token, meetingId, false);
    await age(file.id, 25);
    await cleanUp();

    const meeting = await request(app.getHttpServer())
      .get(`/meetings/${meetingId}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((meeting.body as { files: unknown[] }).files).toEqual([]);
  });
});
