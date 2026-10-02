import { NotFoundException } from '@nestjs/common';
import { QueryBus, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { ListMeetingFilesQuery } from '../../../meeting-files/queries/list-meeting-files/list-meeting-files.query.js';
import type { MeetingDetailsDto } from '../../dto/meeting-details.dto.js';
import { MeetingsRepository } from '../../meetings.repository.js';
import { GetMeetingQuery } from './get-meeting.query.js';

@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<GetMeetingQuery> {
  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly queryBus: QueryBus,
  ) {}

  // A malformed id, a missing meeting and another user's meeting all answer 404,
  // so the response never reveals which ids exist.
  async execute({ id, ownerId }: GetMeetingQuery): Promise<MeetingDetailsDto> {
    const meeting = isUUID(id) ? await this.meetings.findOneByOwner(id, ownerId) : null;
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    const files = await this.queryBus.execute(new ListMeetingFilesQuery(meeting.id));
    return { ...meeting, files };
  }
}
