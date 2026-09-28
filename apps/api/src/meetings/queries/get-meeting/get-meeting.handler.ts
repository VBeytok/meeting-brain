import { NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import type { MeetingDto } from '../../dto/meeting.dto.js';
import { MeetingsRepository } from '../../meetings.repository.js';
import { GetMeetingQuery } from './get-meeting.query.js';

@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<GetMeetingQuery> {
  constructor(private readonly meetings: MeetingsRepository) {}

  // A malformed id, a missing meeting and another user's meeting all answer 404,
  // so the response never reveals which ids exist.
  async execute({ id, ownerId }: GetMeetingQuery): Promise<MeetingDto> {
    const meeting = isUUID(id) ? await this.meetings.findOneByOwner(id, ownerId) : null;
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }
}
