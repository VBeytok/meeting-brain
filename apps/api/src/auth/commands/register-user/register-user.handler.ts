import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UsersService } from '../../../users/users.service.js';
import { AccessTokenService } from '../../access-token.service.js';
import type { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { PasswordHasher } from '../../password-hasher.js';
import { RegisterUserCommand } from './register-user.command.js';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AccessTokenService,
  ) {}

  async execute({ email, password }: RegisterUserCommand): Promise<AuthResponseDto> {
    const user = await this.users.create(email, await this.passwords.hash(password));
    return this.tokens.issue(user);
  }
}
