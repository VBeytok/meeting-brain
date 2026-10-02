import { Query } from '@nestjs/cqrs';
import type { MeetingFileDto } from '../../dto/meeting-file.dto.js';

// A meeting's confirmed files. Not scoped to an owner: send it only for a
// meeting whose ownership is already checked.
export class ListMeetingFilesQuery extends Query<MeetingFileDto[]> {
  constructor(readonly meetingId: string) {
    super();
  }
}
