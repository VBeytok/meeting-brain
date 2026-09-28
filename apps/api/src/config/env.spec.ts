import { validateEnv } from './env.js';

const REQUIRED = { DATABASE_URL: 'postgresql://localhost/db', JWT_SECRET: 'secret' };

describe('validateEnv', () => {
  it.each([undefined, ''])('defaults JWT_EXPIRES_IN=%j to 1h', (value) => {
    expect(validateEnv({ ...REQUIRED, JWT_EXPIRES_IN: value }).JWT_EXPIRES_IN).toBe('1h');
  });

  it.each(['30s', '15m', '1h', '7d'])('accepts JWT_EXPIRES_IN=%s', (value) => {
    expect(validateEnv({ ...REQUIRED, JWT_EXPIRES_IN: value }).JWT_EXPIRES_IN).toBe(value);
  });

  // A bare number would be read as milliseconds by jsonwebtoken.
  it.each(['3600', '1 hour x', '1w'])('rejects JWT_EXPIRES_IN=%j', (value) => {
    expect(() => validateEnv({ ...REQUIRED, JWT_EXPIRES_IN: value })).toThrow(/JWT_EXPIRES_IN/);
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL: REQUIRED.DATABASE_URL })).toThrow(/JWT_SECRET/);
  });
});
