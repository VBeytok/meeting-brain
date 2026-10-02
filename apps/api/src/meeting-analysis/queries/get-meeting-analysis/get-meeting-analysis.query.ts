import { Query } from '@nestjs/cqrs';
import type { MeetingAnalysisDto } from '../../dto/meeting-analysis.dto.js';

// The meeting's analysis, or null when it has none. Not scoped to an owner:
// send it only for a meeting whose ownership is already checked.
export class GetMeetingAnalysisQuery extends Query<MeetingAnalysisDto | null> {
  constructor(readonly meetingId: string) {
    super();
  }
}
