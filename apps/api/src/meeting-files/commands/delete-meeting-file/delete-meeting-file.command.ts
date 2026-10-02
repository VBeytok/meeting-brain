import { Command } from '@nestjs/cqrs';

export class DeleteMeetingFileCommand extends Command<void> {
  constructor(
    readonly fileId: string,
    readonly meetingId: string,
    readonly ownerId: string,
  ) {
    super();
  }
}
