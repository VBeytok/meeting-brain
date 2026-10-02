// A parsed transcript file or a transcribed recording, stored as JSONB on the
// file and sent to the web app.
export type TranscriptSegment = {
  // Seconds from the start. Absent for plain text, which has no timing.
  start?: number;
  end?: number;
  speaker?: string;
  text: string;
};

export type Transcript = {
  // BCP 47 tag when known: a WebVTT `Language:` header, or the language the
  // transcription provider detected. Otherwise null.
  language: string | null;
  segments: TranscriptSegment[];
};

// A file that cannot be read as a transcript. Retrying would not help, so the
// file fails at once instead of going through the queue's retries.
export class TranscriptParseError extends Error {}
