import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PREFIX = 'scrypt';

// Stored format: `scrypt:<salt base64>:<key base64>`.
@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await scryptAsync(password, salt, KEY_BYTES);
    return [PREFIX, salt.toString('base64'), key.toString('base64')].join(':');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [prefix, salt, key] = stored.split(':');
    if (prefix !== PREFIX || !salt || !key) return false;

    const expected = Buffer.from(key, 'base64');
    const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
    return timingSafeEqual(actual, expected);
  }
}
