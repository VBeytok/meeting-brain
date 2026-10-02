import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { MeetingAnalysisDto } from '../../dto/meeting-analysis.dto.js';
import { MeetingAnalysisRepository } from '../../meeting-analysis.repository.js';
import { GetMeetingAnalysisQuery } from './get-meeting-analysis.query.js';

@QueryHandler(GetMeetingAnalysisQuery)
export class GetMeetingAnalysisHandler implements IQueryHandler<GetMeetingAnalysisQuery> {
  constructor(private readonly analyses: MeetingAnalysisRepository) {}

  execute({ meetingId }: GetMeetingAnalysisQuery): Promise<MeetingAnalysisDto | null> {
    return this.analyses.findByMeeting(meetingId);
  }
}
