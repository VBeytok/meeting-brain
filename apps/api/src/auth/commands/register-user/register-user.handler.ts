import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from '../../../users/commands/create-user/create-user.command.js';
import { AuthService } from '../../auth.service.js';
import type { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { RegisterUserCommand } from './register-user.command.js';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly auth: AuthService,
  ) {}

  async execute({ email, password }: RegisterUserCommand): Promise<AuthResponseDto> {
    const passwordHash = await this.auth.hashPassword(password);
    const user = await this.commandBus.execute(new CreateUserCommand(email, passwordHash));
    return this.auth.issueToken(user);
  }
}
