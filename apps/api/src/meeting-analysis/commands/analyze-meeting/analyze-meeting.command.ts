import { Command } from '@nestjs/cqrs';

export class AnalyzeMeetingCommand extends Command<void> {
  constructor(
    readonly meetingId: string,
    // On the queue's last attempt an unexpected error fails the analysis
    // instead of leaving it RUNNING for good.
    readonly isLastAttempt: boolean,
  ) {
    super();
  }
}
