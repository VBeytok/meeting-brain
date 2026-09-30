import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { User } from '../../../generated/prisma/client.js';
import { UsersRepository } from '../../users.repository.js';
import { FindUserByEmailQuery } from './find-user-by-email.query.js';

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailHandler implements IQueryHandler<FindUserByEmailQuery> {
  constructor(private readonly users: UsersRepository) {}

  execute({ email }: FindUserByEmailQuery): Promise<User | null> {
    return this.users.findByEmail(email);
  }
}
