import { Query } from '@nestjs/cqrs';
import type { MeetingDto } from '../../dto/meeting.dto.js';

export class ListMeetingsQuery extends Query<MeetingDto[]> {
  constructor(readonly ownerId: string) {
    super();
  }
}
