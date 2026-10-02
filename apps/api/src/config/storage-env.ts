// Object storage for meeting files: MinIO locally, any S3-compatible service
// (S3, R2) in production.
export type StorageEnv = {
  // Where the API itself reaches storage (e.g. http://minio:9000 inside Docker).
  S3_ENDPOINT: string;
  // Where browsers reach it. Presigned URLs are signed for this host, so it must
  // be the exact origin the browser uploads to.
  S3_PUBLIC_ENDPOINT: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_REGION: string;
  // Bucket in the path (/bucket/key) instead of the host. MinIO needs it.
  S3_FORCE_PATH_STYLE: boolean;
};

const REQUIRED = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;

export function validateStorageEnv(raw: Record<string, unknown>): StorageEnv {
  const missing = REQUIRED.filter((key) => typeof raw[key] !== 'string' || raw[key] === '');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const endpoint = httpUrl(raw.S3_ENDPOINT as string, 'S3_ENDPOINT');
  const publicEndpoint = isSet(raw.S3_PUBLIC_ENDPOINT)
    ? httpUrl(raw.S3_PUBLIC_ENDPOINT as string, 'S3_PUBLIC_ENDPOINT')
    : endpoint;

  const pathStyle = isSet(raw.S3_FORCE_PATH_STYLE) ? raw.S3_FORCE_PATH_STYLE : 'true';
  if (pathStyle !== 'true' && pathStyle !== 'false') {
    throw new Error('S3_FORCE_PATH_STYLE must be true or false');
  }

  return {
    S3_ENDPOINT: endpoint,
    S3_PUBLIC_ENDPOINT: publicEndpoint,
    S3_BUCKET: raw.S3_BUCKET as string,
    S3_ACCESS_KEY_ID: raw.S3_ACCESS_KEY_ID as string,
    S3_SECRET_ACCESS_KEY: raw.S3_SECRET_ACCESS_KEY as string,
    S3_REGION: isSet(raw.S3_REGION) ? (raw.S3_REGION as string) : 'us-east-1',
    S3_FORCE_PATH_STYLE: pathStyle === 'true',
  };
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== '';
}

// An origin with an http(s) scheme, without a trailing slash.
function httpUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a URL, e.g. http://localhost:9000`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must start with http:// or https://`);
  }
  return value.replace(/\/+$/, '');
}
