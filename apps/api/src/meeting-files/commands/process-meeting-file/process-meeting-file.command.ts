import { Command } from '@nestjs/cqrs';

export class ProcessMeetingFileCommand extends Command<void> {
  constructor(
    readonly fileId: string,
    // On the queue's last attempt an unexpected error fails the file instead
    // of leaving it QUEUED for good.
    readonly isLastAttempt: boolean,
  ) {
    super();
  }
}
