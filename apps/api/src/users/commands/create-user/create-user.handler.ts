import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../users.repository.js';
import { type CreatedUser, CreateUserCommand } from './create-user.command.js';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly users: UsersRepository) {}

  async execute({ email, passwordHash }: CreateUserCommand): Promise<CreatedUser> {
    const { id, email: storedEmail } = await this.users.create(email, passwordHash);
    return { id, email: storedEmail };
  }
}
