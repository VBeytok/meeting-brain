import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

type JwtPayload = { sub: string; email: string; iat: number; exp: number };

// Reads the payload without verifying the signature: the tests check what the
// API issues, not how it signs.
function decodeJwt(token: string): JwtPayload {
  const parts = token.split('.');
  expect(parts).toHaveLength(3);
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as JwtPayload;
}

// Every test gets its own email, so tests never collide on the database.
function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

type AuthResponse = { accessToken: string };

function accessTokenOf(res: { body: unknown }): string {
  return (res.body as AuthResponse).accessToken;
}

const PASSWORD = 'correct-horse-battery';

describe('Auth (e2e)', () => {
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

  const register = (body: object) => request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) => request(app.getHttpServer()).post('/auth/login').send(body);

  describe('POST /auth/register', () => {
    it('creates a user and returns a JWT for them', async () => {
      const email = uniqueEmail();

      const res = await register({ email, password: PASSWORD }).expect(201);

      expect(res.body).toEqual({ accessToken: expect.any(String) as string });
      const payload = decodeJwt(accessTokenOf(res));
      expect(payload.email).toBe(email);
      expect(payload.sub).toEqual(expect.any(String));
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects an email that is already registered', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await register({ email, password: 'another-password' }).expect(409);
    });

    it('rejects an email that differs from a registered one only in case', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await register({ email: email.toUpperCase(), password: PASSWORD }).expect(409);
    });

    it('never returns the password', async () => {
      const res = await register({ email: uniqueEmail(), password: PASSWORD }).expect(201);

      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    });

    it.each([
      ['missing email', { password: PASSWORD }],
      ['invalid email', { email: 'not-an-email', password: PASSWORD }],
      ['missing password', { email: uniqueEmail() }],
      ['password shorter than 8 characters', { email: uniqueEmail(), password: 'short' }],
    ])('rejects %s', async (_case, body) => {
      await register(body).expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a JWT for the registered user', async () => {
      const email = uniqueEmail();
      const registered = await register({ email, password: PASSWORD }).expect(201);
      const registeredUserId = decodeJwt(accessTokenOf(registered)).sub;

      const res = await login({ email, password: PASSWORD }).expect(200);

      expect(res.body).toEqual({ accessToken: expect.any(String) as string });
      const payload = decodeJwt(accessTokenOf(res));
      expect(payload.sub).toBe(registeredUserId);
      expect(payload.email).toBe(email);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('matches the email regardless of case', async () => {
      const email = uniqueEmail();
      await register({ email: email.toUpperCase(), password: PASSWORD }).expect(201);

      const res = await login({ email, password: PASSWORD }).expect(200);

      expect(decodeJwt(accessTokenOf(res)).email).toBe(email);
    });

    it('rejects a wrong password', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      await login({ email, password: 'wrong-password' }).expect(401);
    });

    it('rejects an email that was never registered', async () => {
      await login({ email: uniqueEmail(), password: PASSWORD }).expect(401);
    });

    it('gives the same response for unknown email and wrong password', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD }).expect(201);

      const wrongPassword = await login({ email, password: 'wrong-password' }).expect(401);
      const unknownEmail = await login({ email: uniqueEmail(), password: PASSWORD }).expect(401);

      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it.each([
      ['missing email', { password: PASSWORD }],
      ['invalid email', { email: 'not-an-email', password: PASSWORD }],
      ['missing password', { email: uniqueEmail() }],
    ])('rejects %s', async (_case, body) => {
      await login(body).expect(400);
    });
  });
});
