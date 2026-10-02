import { Command } from '@nestjs/cqrs';
import type { CheckTranscriptionJob } from '../../processing/process-file-queue.js';

export class CheckTranscriptionCommand extends Command<void> {
  constructor(
    readonly job: CheckTranscriptionJob,
    // On the queue's last attempt an unexpected error fails the file instead
    // of leaving it TRANSCRIBING for good.
    readonly isLastAttempt: boolean,
  ) {
    super();
  }
}
