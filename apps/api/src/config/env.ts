export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
};

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

// jsonwebtoken reads a bare number string as milliseconds, so a unit is required.
const EXPIRES_IN = /^\d+[smhd]$/;

// Fails at startup instead of on the first request that needs a missing value.
export function validateEnv(raw: Record<string, unknown>): Env {
  const missing = REQUIRED.filter((key) => typeof raw[key] !== 'string' || raw[key] === '');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const expiresIn =
    raw.JWT_EXPIRES_IN === undefined || raw.JWT_EXPIRES_IN === '' ? '1h' : raw.JWT_EXPIRES_IN;
  if (typeof expiresIn !== 'string' || !EXPIRES_IN.test(expiresIn)) {
    throw new Error(`JWT_EXPIRES_IN must be a number with a unit (s, m, h or d), e.g. 15m or 1h`);
  }

  return {
    DATABASE_URL: raw.DATABASE_URL as string,
    JWT_SECRET: raw.JWT_SECRET as string,
    JWT_EXPIRES_IN: expiresIn,
  };
}
