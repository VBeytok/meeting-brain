import type { MeetingFileDto } from './meeting-file.dto.js';

export class CreatedUploadDto {
  file: MeetingFileDto;
  // PUT the bytes here within an hour, with `uploadHeaders`.
  uploadUrl: string;
  // Part of the URL's signature: the PUT fails without them.
  uploadHeaders: Record<string, string>;
}
