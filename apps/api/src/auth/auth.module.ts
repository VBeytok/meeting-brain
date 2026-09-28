import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AccessTokenService } from './access-token.service.js';
import { RegisterUserHandler } from './commands/register-user/register-user.handler.js';
import { LoginHandler } from './queries/login/login.handler.js';
import { PasswordHasher } from './password-hasher.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JwtModuleOptions => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', {
            infer: true,
          }) as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [PasswordHasher, AccessTokenService, RegisterUserHandler, LoginHandler],
})
export class AuthModule {}
