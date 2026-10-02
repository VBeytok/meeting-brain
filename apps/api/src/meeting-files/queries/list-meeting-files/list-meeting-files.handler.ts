import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MeetingFileDto } from '../../dto/meeting-file.dto.js';
import { MeetingFilesRepository, withoutStorageKey } from '../../meeting-files.repository.js';
import { ListMeetingFilesQuery } from './list-meeting-files.query.js';

@QueryHandler(ListMeetingFilesQuery)
export class ListMeetingFilesHandler implements IQueryHandler<ListMeetingFilesQuery> {
  constructor(private readonly files: MeetingFilesRepository) {}

  async execute({ meetingId }: ListMeetingFilesQuery): Promise<MeetingFileDto[]> {
    return (await this.files.findConfirmedByMeeting(meetingId)).map(withoutStorageKey);
  }
}
