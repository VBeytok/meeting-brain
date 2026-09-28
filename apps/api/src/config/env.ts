export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
};

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

// Fails at startup instead of on the first request that needs a missing value.
export function validateEnv(raw: Record<string, unknown>): Env {
  const missing = REQUIRED.filter((key) => typeof raw[key] !== 'string' || raw[key] === '');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    DATABASE_URL: raw.DATABASE_URL as string,
    JWT_SECRET: raw.JWT_SECRET as string,
    JWT_EXPIRES_IN: typeof raw.JWT_EXPIRES_IN === 'string' ? raw.JWT_EXPIRES_IN : '1h',
  };
}
