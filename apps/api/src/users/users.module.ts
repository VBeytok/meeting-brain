import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CreateUserHandler } from './commands/create-user/create-user.handler.js';
import { FindUserByEmailHandler } from './queries/find-user-by-email/find-user-by-email.handler.js';
import { UsersRepository } from './users.repository.js';

// Exports nothing: other modules reach users through CreateUserCommand and
// FindUserByEmailQuery on the buses.
@Module({
  imports: [PrismaModule],
  providers: [UsersRepository, CreateUserHandler, FindUserByEmailHandler],
})
export class UsersModule {}
