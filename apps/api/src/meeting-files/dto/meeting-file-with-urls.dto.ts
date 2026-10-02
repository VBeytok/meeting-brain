import { MeetingFileDto } from './meeting-file.dto.js';

// A confirmed file as the meeting page sees it. Both URLs are presigned and
// expire after 15 minutes; every fetch of the meeting issues fresh ones.
export class MeetingFileWithUrlsDto extends MeetingFileDto {
  // Streams the file with its own type, for <audio> / <video>.
  playbackUrl: string;
  // The same bytes as an attachment, saved under the original name.
  downloadUrl: string;
}
