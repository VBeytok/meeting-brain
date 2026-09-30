import { Command } from '@nestjs/cqrs';
import type { User } from '../../../generated/prisma/client.js';

export type CreatedUser = Pick<User, 'id' | 'email'>;

// Takes a hash, not a password: hashing is auth's job, users only stores it.
// Returns only id and email, so the hash does not travel back over the bus.
export class CreateUserCommand extends Command<CreatedUser> {
  constructor(
    readonly email: string,
    readonly passwordHash: string,
  ) {
    super();
  }
}
