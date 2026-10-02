import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// The fakes answer at once, whatever .env says. Set before AppModule loads
// its config; .env does not override them.
process.env.ASSEMBLYAI_API_KEY = '';
process.env.FAKE_TRANSCRIPTION_DELAY_SECONDS = '0';
process.env.ANTHROPIC_API_KEY = '';
process.env.FAKE_ANALYSIS_DELAY_SECONDS = '0';

type Analysis = {
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';
  summary: string | null;
  actionItems: { text: string; owner?: string; dueDate?: string }[];
  decisions: string[];
  language: string | null;
  skippedFileIds: string[];
  error: string | null;
  generatedAt: string | null;
};
type Meeting = { files: { id: string; status: string }[]; analysis: Analysis | null };
type CreatedUpload = {
  file: { id: string };
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
};

const VTT = ['WEBVTT', 'Language: en', '', '00:00:01.000 --> 00:00:03.000', '<v Alice>Hello.'].join(
  '\n',
);

describe('Meeting analysis (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

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
      .send({ title: 'Planning', date: '2026-10-01T10:00:00.000Z', participants: [] })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  const getMeeting = async (token: string, meetingId: string): Promise<Meeting> => {
    const res = await request(app.getHttpServer())
      .get(`/meetings/${meetingId}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    return res.body as Meeting;
  };

  // Registers a transcript file and PUTs its bytes; `complete` confirms it.
  async function uploaded(token: string, meetingId: string, name: string, text: string) {
    const bytes = Buffer.from(text, 'utf8');
    const res = await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .auth(token, { type: 'bearer' })
      .send({
        name,
        mimeType: name.endsWith('.vtt') ? 'text/vtt' : 'text/plain',
        size: bytes.length,
      })
      .expect(201);
    const upload = res.body as CreatedUpload;
    const put = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: upload.uploadHeaders,
      body: new Uint8Array(bytes),
    });
    expect(put.status).toBe(200);
    return upload.file.id;
  }

  const complete = (token: string, meetingId: string, fileId: string) =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files/${fileId}/complete`)
      .auth(token, { type: 'bearer' })
      .expect(200);

  async function addFile(token: string, meetingId: string, name: string, text: string) {
    const id = await uploaded(token, meetingId, name, text);
    await complete(token, meetingId, id);
    return id;
  }

  const deleteFile = (token: string, meetingId: string, fileId: string) =>
    request(app.getHttpServer())
      .delete(`/meetings/${meetingId}/files/${fileId}`)
      .auth(token, { type: 'bearer' })
      .expect(204);

  const retry = (token: string, meetingId: string) =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/analysis/retry`)
      .auth(token, { type: 'bearer' });

  // Polls the meeting, as the web app does, until `done` holds.
  async function until(
    token: string,
    meetingId: string,
    done: (meeting: Meeting) => boolean,
  ): Promise<Meeting> {
    for (let i = 0; i < 100; i++) {
      const meeting = await getMeeting(token, meetingId);
      if (done(meeting)) return meeting;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Meeting ${meetingId} did not get there`);
  }

  const settled = (meeting: Meeting) =>
    meeting.analysis?.status === 'READY' || meeting.analysis?.status === 'FAILED';

  it('has no analysis before any file is processed', async () => {
    const token = await signUp();
    const meetingId = await createMeeting(token);
    expect((await getMeeting(token, meetingId)).analysis).toBeNull();
  });

  it('builds the analysis once a transcript is processed', async () => {
    const token = await signUp();
    const meetingId = await createMeeting(token);
    await addFile(token, meetingId, 'call.vtt', VTT);

    const { analysis } = await until(token, meetingId, settled);
    expect(analysis).toMatchObject({
      status: 'READY',
      language: 'en',
      skippedFileIds: [],
      error: null,
    });
    expect(analysis?.summary).toContain('1 part(s) (call.vtt)');
    expect(analysis?.actionItems).toContainEqual({
      text: expect.any(String) as string,
      owner: 'Speaker B',
      dueDate: 'Friday',
    });
    expect(analysis?.decisions.length).toBeGreaterThan(0);
    expect(Date.parse(analysis!.generatedAt!)).not.toBeNaN();
  });

  it('waits for every file, and combines them in upload order', async () => {
    const token = await signUp();
    const meetingId = await createMeeting(token);
    const first = await addFile(token, meetingId, 'part-1.vtt', VTT);
    // Uploaded but not confirmed yet: the analysis must wait for it.
    const second = await uploaded(token, meetingId, 'part-2.txt', 'Second half.');

    await until(token, meetingId, (m) => m.files.find((f) => f.id === first)?.status === 'READY');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect((await getMeeting(token, meetingId)).analysis?.status).toBe('PENDING');

    await complete(token, meetingId, second);
    const { analysis } = await until(token, meetingId, settled);
    expect(analysis?.summary).toContain('2 part(s) (part-1.vtt, part-2.txt)');
  });

  it('skips a failed file and says so', async () => {
    const token = await signUp();
    const meetingId = await createMeeting(token);
    await addFile(token, meetingId, 'good.vtt', VTT);
    const broken = await addFile(token, meetingId, 'broken.vtt', 'not a caption file');

    const { analysis } = await until(
      token,
      meetingId,
      (m) => settled(m) && m.analysis!.skippedFileIds.length > 0,
    );
    expect(analysis).toMatchObject({ status: 'READY', skippedFileIds: [broken] });
    expect(analysis?.summary).toContain('1 part(s) (good.vtt)');
  });

  it('rebuilds after a delete, and removes the analysis with the last file', async () => {
    const token = await signUp();
    const meetingId = await createMeeting(token);
    const first = await addFile(token, meetingId, 'a.vtt', VTT);
    const second = await addFile(token, meetingId, 'b.txt', 'More.');
    await until(token, meetingId, (m) => settled(m) && m.analysis!.summary!.includes('2 part(s)'));

    await deleteFile(token, meetingId, first);
    const rebuilt = await until(
      token,
      meetingId,
      (m) => settled(m) && m.analysis!.summary!.includes('1 part(s) (b.txt)'),
    );
    expect(rebuilt.analysis?.status).toBe('READY');

    await deleteFile(token, meetingId, second);
    await until(token, meetingId, (m) => m.analysis === null);
  });

  it('retries only a failed analysis', async () => {
    const token = await signUp();
    const meetingId = await createMeeting(token);
    await retry(token, meetingId).expect(409);

    // The fake analyzer fails on this marker.
    await addFile(token, meetingId, 'bad.txt', 'FAKE_ANALYSIS_FAILURE');
    const failed = await until(token, meetingId, settled);
    expect(failed.analysis).toMatchObject({ status: 'FAILED', summary: null });
    expect(failed.analysis?.error).toBe('The fake analyzer was told to fail.');

    const retried = await retry(token, meetingId).expect(200);
    expect(retried.body).toMatchObject({ status: 'PENDING', error: null });
    expect((await until(token, meetingId, settled)).analysis?.status).toBe('FAILED');

    const other = await createMeeting(token);
    await addFile(token, other, 'ok.vtt', VTT);
    await until(token, other, settled);
    await retry(token, other).expect(409);
  });

  it('answers 401 without a token and 404 for a meeting that is not yours', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const meetingId = await createMeeting(owner);
    await request(app.getHttpServer()).post(`/meetings/${meetingId}/analysis/retry`).expect(401);
    await retry(stranger, meetingId).expect(404);
    await retry(owner, 'not-a-uuid').expect(404);
  });
});
