import { Injectable } from '@nestjs/common';
import { JobQueue } from '../queue/job-queue.js';
import {
  ANALYZE_MEETING_QUEUE,
  analyzeMeetingOptions,
  type AnalyzeMeetingJob,
} from './analyze-meeting-queue.js';
import { MeetingAnalysisRepository } from './meeting-analysis.repository.js';

// Marks a meeting's analysis due and queues the job that builds it.
@Injectable()
export class AnalysisScheduler {
  constructor(
    private readonly analyses: MeetingAnalysisRepository,
    private readonly queue: JobQueue,
  ) {}

  async schedule(meetingId: string): Promise<void> {
    await this.analyses.markPending(meetingId);
    await this.queue.send<AnalyzeMeetingJob>(
      ANALYZE_MEETING_QUEUE,
      { meetingId },
      analyzeMeetingOptions(meetingId),
    );
  }
}
