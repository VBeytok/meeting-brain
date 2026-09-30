import { Query } from '@nestjs/cqrs';
import type { User } from '../../../generated/prisma/client.js';

export class FindUserByEmailQuery extends Query<User | null> {
  constructor(readonly email: string) {
    super();
  }
}
