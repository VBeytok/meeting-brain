import type { MeetingFileKind, MeetingFileStatus } from '../../generated/prisma/client.js';

export class MeetingFileDto {
  id: string;
  name: string;
  mimeType: string;
  // Bytes.
  size: number;
  kind: MeetingFileKind;
  status: MeetingFileStatus;
  // ISO 8601, UTC.
  createdAt: string;
}
