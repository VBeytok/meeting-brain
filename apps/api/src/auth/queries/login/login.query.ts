import { Query } from '@nestjs/cqrs';
import type { AuthResponseDto } from '../../dto/auth-response.dto.js';

// A query: checks credentials against stored users and changes no state.
export class LoginQuery extends Query<AuthResponseDto> {
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super();
  }
}
