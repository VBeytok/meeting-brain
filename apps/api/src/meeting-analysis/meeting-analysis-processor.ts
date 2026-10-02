import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JobQueue } from '../queue/job-queue.js';
import {
  ANALYZE_MEETING_QUEUE,
  ANALYZE_MEETING_SETTINGS,
  type AnalyzeMeetingJob,
} from './analyze-meeting-queue.js';
import { AnalyzeMeetingCommand } from './commands/analyze-meeting/analyze-meeting.command.js';

// Works the analysis queue: each job becomes an AnalyzeMeetingCommand.
@Injectable()
export class MeetingAnalysisProcessor implements OnApplicationBootstrap {
  constructor(
    private readonly queue: JobQueue,
    private readonly commandBus: CommandBus,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.define(ANALYZE_MEETING_QUEUE, ANALYZE_MEETING_SETTINGS);
    await this.queue.work<AnalyzeMeetingJob>(ANALYZE_MEETING_QUEUE, ({ data, isLastAttempt }) =>
      this.commandBus.execute(new AnalyzeMeetingCommand(data.meetingId, isLastAttempt)),
    );
  }
}
