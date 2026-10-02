import { Query } from '@nestjs/cqrs';
import type { MeetingDetailsDto } from '../../dto/meeting-details.dto.js';

export class GetMeetingQuery extends Query<MeetingDetailsDto> {
  constructor(
    readonly id: string,
    readonly ownerId: string,
  ) {
    super();
  }
}
