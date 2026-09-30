import { Command } from '@nestjs/cqrs';
import type { User } from '../../../generated/prisma/client.js';

// Takes a hash, not a password: hashing is auth's job, users only stores it.
export class CreateUserCommand extends Command<User> {
  constructor(
    readonly email: string,
    readonly passwordHash: string,
  ) {
    super();
  }
}
