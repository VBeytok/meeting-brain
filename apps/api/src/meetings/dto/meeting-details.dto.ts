import type { MeetingFileDto } from '../../meeting-files/dto/meeting-file.dto.js';
import { MeetingDto } from './meeting.dto.js';

// One meeting with its confirmed files. The list endpoint returns plain MeetingDto.
export class MeetingDetailsDto extends MeetingDto {
  files: MeetingFileDto[];
}
