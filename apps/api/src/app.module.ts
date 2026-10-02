import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { validateStorageEnv } from './config/storage-env.js';
import { validateTranscriptionEnv } from './config/transcription-env.js';
import { validateAnalysisEnv } from './config/analysis-env.js';
import { MeetingsModule } from './meetings/meetings.module.js';
import { MeetingFilesModule } from './meeting-files/meeting-files.module.js';
import { MeetingAnalysisModule } from './meeting-analysis/meeting-analysis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => ({
        ...validateEnv(raw),
        ...validateStorageEnv(raw),
        ...validateTranscriptionEnv(raw),
        ...validateAnalysisEnv(raw),
      }),
    }),
    CqrsModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    MeetingsModule,
    MeetingFilesModule,
    MeetingAnalysisModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here rather than in main.ts so e2e tests, which boot AppModule, get it too.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    },
  ],
})
export class AppModule {}
