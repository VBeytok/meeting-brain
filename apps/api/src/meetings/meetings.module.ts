import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CreateMeetingHandler } from './commands/create-meeting/create-meeting.handler.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsRepository } from './meetings.repository.js';
import { GetMeetingHandler } from './queries/get-meeting/get-meeting.handler.js';
import { ListMeetingsHandler } from './queries/list-meetings/list-meetings.handler.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MeetingsController],
  providers: [MeetingsRepository, CreateMeetingHandler, ListMeetingsHandler, GetMeetingHandler],
})
export class MeetingsModule {}
