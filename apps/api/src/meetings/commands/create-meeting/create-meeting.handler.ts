import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { MeetingDto } from '../../dto/meeting.dto.js';
import { MeetingsRepository } from '../../meetings.repository.js';
import { CreateMeetingCommand } from './create-meeting.command.js';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
  constructor(private readonly meetings: MeetingsRepository) {}

  execute({ ownerId, title, date, participants }: CreateMeetingCommand): Promise<MeetingDto> {
    return this.meetings.create({ ownerId, title, date: new Date(date), participants });
  }
}
