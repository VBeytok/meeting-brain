import { Command } from '@nestjs/cqrs';
import type { MeetingFileDto } from '../../dto/meeting-file.dto.js';

export class CompleteMeetingFileUploadCommand extends Command<MeetingFileDto> {
  constructor(
    readonly fileId: string,
    readonly meetingId: string,
    readonly ownerId: string,
  ) {
    super();
  }
}
