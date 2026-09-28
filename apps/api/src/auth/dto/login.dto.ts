import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// No length rule: login only checks the password against the stored hash.
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
