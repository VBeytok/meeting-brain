import { Injectable, UnauthorizedException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../generated/prisma/client.js';
import { FindUserByEmailQuery } from '../users/queries/find-user-by-email/find-user-by-email.query.js';
import type { AuthUser } from './current-user.decorator.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import { PasswordHasher } from './password-hasher.js';

export type JwtPayload = { sub: string; email: string };

// Credentials and access tokens. User records live in the users module and are
// reached through the query bus.
@Injectable()
export class AuthService {
  // Checked against when the email is unknown, so a miss costs as much time as a
  // wrong password and response timing does not reveal which emails exist.
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly jwt: JwtService,
    private readonly passwords: PasswordHasher,
    private readonly queryBus: QueryBus,
  ) {
    this.dummyHash = passwords.hash('dummy-password-for-timing');
  }

  hashPassword(password: string): Promise<string> {
    return this.passwords.hash(password);
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    const valid = await this.passwords.verify(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async issueToken(user: Pick<User, 'id' | 'email'>): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      return { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
