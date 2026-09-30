import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { User } from '../../../generated/prisma/client.js';
import { UsersRepository } from '../../users.repository.js';
import { CreateUserCommand } from './create-user.command.js';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly users: UsersRepository) {}

  execute({ email, passwordHash }: CreateUserCommand): Promise<User> {
    return this.users.create(email, passwordHash);
  }
}
