import { UnauthorizedException } from '@nestjs/common';
import type { QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../generated/prisma/client.js';
import { FindUserByEmailQuery } from '../users/queries/find-user-by-email/find-user-by-email.query.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
  const passwords = new PasswordHasher();
  const execute = vi.fn();
  const auth = new AuthService(jwt, passwords, { execute } as unknown as QueryBus);

  const userWith = async (password: string): Promise<User> => ({
    id: 'user-1',
    email: 'ada@example.com',
    passwordHash: await passwords.hash(password),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => execute.mockReset());

  it('issues a token that verifies back to the same user', async () => {
    const { accessToken } = await auth.issueToken({ id: 'user-1', email: 'ada@example.com' });

    expect(await auth.verifyToken(accessToken)).toEqual({ id: 'user-1', email: 'ada@example.com' });
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = await new JwtService({ secret: 'other-secret' }).signAsync({ sub: 'x' });

    await expect(auth.verifyToken(foreign)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a malformed token', async () => {
    await expect(auth.verifyToken('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the user for valid credentials, looked up through the query bus', async () => {
    const user = await userWith('correct-horse-battery');
    execute.mockResolvedValue(user);

    expect(await auth.validateCredentials('Ada@example.com', 'correct-horse-battery')).toBe(user);
    expect(execute).toHaveBeenCalledWith(new FindUserByEmailQuery('Ada@example.com'));
  });

  it('rejects a wrong password', async () => {
    execute.mockResolvedValue(await userWith('correct-horse-battery'));

    await expect(
      auth.validateCredentials('ada@example.com', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email', async () => {
    execute.mockResolvedValue(null);

    await expect(
      auth.validateCredentials('nobody@example.com', 'correct-horse-battery'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('hashes passwords so they verify but are not stored in plain text', async () => {
    const hash = await auth.hashPassword('correct-horse-battery');

    expect(hash).not.toContain('correct-horse-battery');
    expect(await passwords.verify('correct-horse-battery', hash)).toBe(true);
  });
});
