import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { AuthService } from '../../auth.service.js';
import type { AuthResponseDto } from '../../dto/auth-response.dto.js';
import { LoginQuery } from './login.query.js';

@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery> {
  constructor(private readonly auth: AuthService) {}

  async execute({ email, password }: LoginQuery): Promise<AuthResponseDto> {
    return this.auth.issueToken(await this.auth.validateCredentials(email, password));
  }
}
