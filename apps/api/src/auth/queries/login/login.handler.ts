import { UnauthorizedException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { UsersService } from '../../../users/users.service.js';
import { AccessTokenService } from '../../access-token.service.js';
import type { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { PasswordHasher } from '../../password-hasher.js';
import { LoginQuery } from './login.query.js';

@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery> {
  // Checked against when the email is unknown, so a miss costs as much time as a
  // wrong password and response timing does not reveal which emails exist.
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AccessTokenService,
  ) {
    this.dummyHash = passwords.hash('dummy-password-for-timing');
  }

  async execute({ email, password }: LoginQuery): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(email);
    const valid = await this.passwords.verify(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokens.issue(user);
  }
}
