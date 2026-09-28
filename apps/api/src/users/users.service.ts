import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Relies on the unique index rather than a lookup first, so two concurrent
  // registrations with one email cannot both succeed.
  async create(email: string, passwordHash: string): Promise<User> {
    try {
      return await this.prisma.user.create({ data: { email, passwordHash } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}
