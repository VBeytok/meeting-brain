import { ConflictException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { GetMeetingQuery } from '../../../meetings/queries/get-meeting/get-meeting.query.js';
import { JobQueue } from '../../../queue/job-queue.js';
import {
  ANALYZE_MEETING_QUEUE,
  analyzeMeetingOptions,
  type AnalyzeMeetingJob,
} from '../../analyze-meeting-queue.js';
import type { MeetingAnalysisDto } from '../../dto/meeting-analysis.dto.js';
import { MeetingAnalysisRepository } from '../../meeting-analysis.repository.js';
import { RetryMeetingAnalysisCommand } from './retry-meeting-analysis.command.js';

// Rebuilds a FAILED analysis. Any other state answers 409.
@CommandHandler(RetryMeetingAnalysisCommand)
export class RetryMeetingAnalysisHandler implements ICommandHandler<RetryMeetingAnalysisCommand> {
  constructor(
    private readonly analyses: MeetingAnalysisRepository,
    private readonly queue: JobQueue,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({ meetingId, ownerId }: RetryMeetingAnalysisCommand): Promise<MeetingAnalysisDto> {
    // 404 for a missing, malformed or someone else's meeting.
    await this.queryBus.execute(new GetMeetingQuery(meetingId, ownerId));
    if (!(await this.analyses.requeue(meetingId))) {
      throw new ConflictException('Only a summary that failed can be retried');
    }
    await this.queue.send<AnalyzeMeetingJob>(
      ANALYZE_MEETING_QUEUE,
      { meetingId },
      analyzeMeetingOptions(meetingId),
    );
    return (await this.analyses.findByMeeting(meetingId))!;
  }
}
