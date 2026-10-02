import type { MeetingFileKind, MeetingFileStatus } from '../../generated/prisma/client.js';
import type { Transcript } from '../transcripts/transcript.js';

export class MeetingFileDto {
  id: string;
  name: string;
  mimeType: string;
  // Bytes.
  size: number;
  kind: MeetingFileKind;
  status: MeetingFileStatus;
  // The parsed transcript once a transcript file is READY, else null.
  transcript: Transcript | null;
  // Why processing failed, when FAILED, else null.
  error: string | null;
  // ISO 8601, UTC.
  createdAt: string;
}
