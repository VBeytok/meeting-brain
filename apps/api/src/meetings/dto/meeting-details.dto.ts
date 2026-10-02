import type { MeetingAnalysisDto } from '../../meeting-analysis/dto/meeting-analysis.dto.js';
import type { MeetingFileWithUrlsDto } from '../../meeting-files/dto/meeting-file-with-urls.dto.js';
import { MeetingDto } from './meeting.dto.js';

// One meeting with its confirmed files and its analysis (null until a file is
// processed). The list endpoint returns plain MeetingDto.
export class MeetingDetailsDto extends MeetingDto {
  files: MeetingFileWithUrlsDto[];
  analysis: MeetingAnalysisDto | null;
}
