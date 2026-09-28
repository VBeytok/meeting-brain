import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { MeetingDto } from '../../dto/meeting.dto.js';
import { MeetingsRepository } from '../../meetings.repository.js';
import { ListMeetingsQuery } from './list-meetings.query.js';

@QueryHandler(ListMeetingsQuery)
export class ListMeetingsHandler implements IQueryHandler<ListMeetingsQuery> {
  constructor(private readonly meetings: MeetingsRepository) {}

  execute({ ownerId }: ListMeetingsQuery): Promise<MeetingDto[]> {
    return this.meetings.findAllByOwner(ownerId);
  }
}
