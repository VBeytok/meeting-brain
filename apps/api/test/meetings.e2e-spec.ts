import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

type Meeting = { id: string; title: string; date: string; participants: string[] };

const NEW_MEETING = {
  title: 'Sprint planning',
  date: '2026-10-01T10:00:00.000Z',
  participants: ['alice@example.com', 'bob@example.com'],
};

describe('Meetings (e2e)', () => {
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

  // Registers a fresh user, so every test starts with an empty meeting list.
  async function signUp(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `user-${randomUUID()}@example.com`, password: 'correct-horse-battery' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  const createMeeting = (token: string, body: object) =>
    request(app.getHttpServer()).post('/meetings').auth(token, { type: 'bearer' }).send(body);
  const listMeetings = (token: string) =>
    request(app.getHttpServer()).get('/meetings').auth(token, { type: 'bearer' });
  const getMeeting = (token: string, id: string) =>
    request(app.getHttpServer()).get(`/meetings/${id}`).auth(token, { type: 'bearer' });

  async function createdMeeting(token: string, body: object = NEW_MEETING): Promise<Meeting> {
    const res = await createMeeting(token, body).expect(201);
    return res.body as Meeting;
  }

  describe('authentication', () => {
    it.each([
      ['POST /meetings', () => request(app.getHttpServer()).post('/meetings').send(NEW_MEETING)],
      ['GET /meetings', () => request(app.getHttpServer()).get('/meetings')],
      ['GET /meetings/:id', () => request(app.getHttpServer()).get(`/meetings/${randomUUID()}`)],
    ])('%s rejects a request without a token', async (_route, send) => {
      await send().expect(401);
    });

    it('rejects a malformed token', async () => {
      await listMeetings('not-a-jwt').expect(401);
    });

    it('rejects a token with a forged signature', async () => {
      const [header, payload] = (await signUp()).split('.');

      await listMeetings(`${header}.${payload}.forged-signature`).expect(401);
    });
  });

  describe('POST /meetings', () => {
    it('creates a meeting and returns it', async () => {
      const token = await signUp();

      const res = await createMeeting(token, NEW_MEETING).expect(201);

      expect(res.body).toMatchObject(NEW_MEETING);
      expect((res.body as Meeting).id).toEqual(expect.any(String));
    });

    it('accepts a meeting with no participants', async () => {
      const token = await signUp();

      const res = await createMeeting(token, { ...NEW_MEETING, participants: [] }).expect(201);

      expect((res.body as Meeting).participants).toEqual([]);
    });

    it.each([
      ['missing title', { date: NEW_MEETING.date, participants: NEW_MEETING.participants }],
      ['empty title', { ...NEW_MEETING, title: '' }],
      ['missing date', { title: NEW_MEETING.title, participants: NEW_MEETING.participants }],
      ['invalid date', { ...NEW_MEETING, date: 'next tuesday' }],
      ['missing participants', { title: NEW_MEETING.title, date: NEW_MEETING.date }],
      ['participants that is not an array', { ...NEW_MEETING, participants: 'alice' }],
      ['a participant that is not a string', { ...NEW_MEETING, participants: ['alice', 42] }],
      ['an empty participant', { ...NEW_MEETING, participants: ['alice', ''] }],
    ])('rejects %s', async (_case, body) => {
      const token = await signUp();

      await createMeeting(token, body).expect(400);
    });
  });

  describe('GET /meetings', () => {
    it('returns an empty list for a user with no meetings', async () => {
      const token = await signUp();

      const res = await listMeetings(token).expect(200);

      expect(res.body).toEqual([]);
    });

    it("returns all of the user's meetings", async () => {
      const token = await signUp();
      const first = await createdMeeting(token);
      const second = await createdMeeting(token, {
        title: 'Retro',
        date: '2026-10-02T15:30:00.000Z',
        participants: ['carol@example.com'],
      });

      const res = await listMeetings(token).expect(200);

      const meetings = res.body as Meeting[];
      expect(meetings).toHaveLength(2);
      expect(meetings).toEqual(
        expect.arrayContaining([expect.objectContaining(first), expect.objectContaining(second)]),
      );
    });

    it("does not return other users' meetings", async () => {
      const owner = await signUp();
      const someoneElse = await signUp();
      await createdMeeting(owner);

      const res = await listMeetings(someoneElse).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /meetings/:id', () => {
    it('returns the meeting', async () => {
      const token = await signUp();
      const meeting = await createdMeeting(token);

      const res = await getMeeting(token, meeting.id).expect(200);

      expect(res.body).toEqual(meeting);
    });

    // Creating a meeting first proves the route exists, so the 404 comes from the lookup.
    it('returns 404 for an id that does not exist', async () => {
      const token = await signUp();
      await createdMeeting(token);

      await getMeeting(token, randomUUID()).expect(404);
    });

    // Creating a meeting first proves the route exists, so the 404 comes from the lookup.
    it('returns 404 for an id that is not a UUID', async () => {
      const token = await signUp();
      await createdMeeting(token);

      await getMeeting(token, 'not-a-uuid').expect(404);
    });

    // 404 rather than 403, so ids of other users' meetings cannot be probed.
    it("returns 404 for another user's meeting", async () => {
      const owner = await signUp();
      const someoneElse = await signUp();
      const meeting = await createdMeeting(owner);

      await getMeeting(someoneElse, meeting.id).expect(404);
    });
  });
});
