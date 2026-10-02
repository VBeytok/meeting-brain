import { Command } from '@nestjs/cqrs';
import type { MeetingAnalysisDto } from '../../dto/meeting-analysis.dto.js';

export class RetryMeetingAnalysisCommand extends Command<MeetingAnalysisDto> {
  constructor(
    readonly meetingId: string,
    readonly ownerId: string,
  ) {
    super();
  }
}
