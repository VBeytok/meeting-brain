import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../generated/prisma/client.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(user: Pick<User, 'id' | 'email'>): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
