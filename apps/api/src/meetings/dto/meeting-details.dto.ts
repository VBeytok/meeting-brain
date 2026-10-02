import type { MeetingFileWithUrlsDto } from '../../meeting-files/dto/meeting-file-with-urls.dto.js';
import { MeetingDto } from './meeting.dto.js';

// One meeting with its confirmed files. The list endpoint returns plain MeetingDto.
export class MeetingDetailsDto extends MeetingDto {
  files: MeetingFileWithUrlsDto[];
}
