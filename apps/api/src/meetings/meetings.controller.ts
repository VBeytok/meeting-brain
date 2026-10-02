import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateMeetingCommand } from './commands/create-meeting/create-meeting.command.js';
import { CreateMeetingDto } from './dto/create-meeting.dto.js';
import type { MeetingDetailsDto } from './dto/meeting-details.dto.js';
import { MeetingDto } from './dto/meeting.dto.js';
import { GetMeetingQuery } from './queries/get-meeting/get-meeting.query.js';
import { ListMeetingsQuery } from './queries/list-meetings/list-meetings.query.js';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() { title, date, participants }: CreateMeetingDto,
  ): Promise<MeetingDto> {
    return this.commandBus.execute(new CreateMeetingCommand(user.id, title, date, participants));
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<MeetingDto[]> {
    return this.queryBus.execute(new ListMeetingsQuery(user.id));
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<MeetingDetailsDto> {
    return this.queryBus.execute(new GetMeetingQuery(id, user.id));
  }
}
