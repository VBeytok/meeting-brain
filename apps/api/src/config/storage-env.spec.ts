import { validateStorageEnv } from './storage-env.js';

const VALID = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'meeting-brain',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('validateStorageEnv', () => {
  it('defaults the public endpoint, region and path style', () => {
    expect(validateStorageEnv(VALID)).toEqual({
      ...VALID,
      S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_FORCE_PATH_STYLE: true,
    });
  });

  it('keeps explicit values and drops trailing slashes', () => {
    const env = validateStorageEnv({
      ...VALID,
      S3_ENDPOINT: 'http://minio:9000/',
      S3_PUBLIC_ENDPOINT: 'https://files.example.com/',
      S3_REGION: 'auto',
      S3_FORCE_PATH_STYLE: 'false',
    });
    expect(env.S3_ENDPOINT).toBe('http://minio:9000');
    expect(env.S3_PUBLIC_ENDPOINT).toBe('https://files.example.com');
    expect(env.S3_REGION).toBe('auto');
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it.each(['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'])(
    'requires %s',
    (key) => {
      expect(() => validateStorageEnv({ ...VALID, [key]: '' })).toThrow(key);
    },
  );

  it.each([
    ['S3_ENDPOINT', 'localhost:9000'],
    ['S3_ENDPOINT', 'not a url'],
    ['S3_PUBLIC_ENDPOINT', 'ftp://files.example.com'],
  ])('rejects %s=%s', (key, value) => {
    expect(() => validateStorageEnv({ ...VALID, [key]: value })).toThrow(key);
  });

  it('rejects a path style that is not true or false', () => {
    expect(() => validateStorageEnv({ ...VALID, S3_FORCE_PATH_STYLE: 'yes' })).toThrow(
      'S3_FORCE_PATH_STYLE',
    );
  });
});
