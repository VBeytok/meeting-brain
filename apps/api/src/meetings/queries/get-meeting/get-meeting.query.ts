import { Query } from '@nestjs/cqrs';
import type { MeetingDto } from '../../dto/meeting.dto.js';

export class GetMeetingQuery extends Query<MeetingDto> {
  constructor(
    readonly id: string,
    readonly ownerId: string,
  ) {
    super();
  }
}
