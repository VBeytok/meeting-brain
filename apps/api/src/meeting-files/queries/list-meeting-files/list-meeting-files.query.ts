import { Query } from '@nestjs/cqrs';
import type { MeetingFileWithUrlsDto } from '../../dto/meeting-file-with-urls.dto.js';

// A meeting's confirmed files, with fresh playback and download URLs. Not
// scoped to an owner: send it only for a meeting whose ownership is already
// checked.
export class ListMeetingFilesQuery extends Query<MeetingFileWithUrlsDto[]> {
  constructor(readonly meetingId: string) {
    super();
  }
}
