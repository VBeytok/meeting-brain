import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('verifies the password it hashed', async () => {
    const hash = await hasher.hash('correct-horse-battery');

    expect(await hasher.verify('correct-horse-battery', hash)).toBe(true);
  });

  it('rejects a different password', async () => {
    const hash = await hasher.hash('correct-horse-battery');

    expect(await hasher.verify('correct-horse-batterY', hash)).toBe(false);
  });

  it('does not store the password in plain text', async () => {
    const hash = await hasher.hash('correct-horse-battery');

    expect(hash).not.toContain('correct-horse-battery');
  });

  it('salts every hash, so equal passwords hash differently', async () => {
    const first = await hasher.hash('correct-horse-battery');
    const second = await hasher.hash('correct-horse-battery');

    expect(first).not.toBe(second);
  });

  it('rejects a malformed hash instead of throwing', async () => {
    expect(await hasher.verify('correct-horse-battery', 'not-a-hash')).toBe(false);
  });
});
