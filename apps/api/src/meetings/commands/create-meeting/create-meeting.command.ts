import { Command } from '@nestjs/cqrs';
import type { MeetingDto } from '../../dto/meeting.dto.js';

export class CreateMeetingCommand extends Command<MeetingDto> {
  constructor(
    readonly ownerId: string,
    readonly title: string,
    readonly date: string,
    readonly participants: string[],
  ) {
    super();
  }
}
