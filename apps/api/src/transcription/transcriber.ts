import type { Readable } from 'node:stream';
import type { Transcript } from '../meeting-files/transcripts/transcript.js';

// Where a provider's transcription job stands.
export type TranscriptionStatus =
  | { state: 'processing' }
  | { state: 'completed'; transcript: Transcript }
  | { state: 'failed'; error: string };

// Speech to text for recordings, with speaker labels, timestamps and language
// detection. An abstract class rather than an interface so it can be the
// injection token. Providers run jobs asynchronously: `submit` starts one and
// `check` is polled until it is no longer processing.
export abstract class Transcriber {
  // Sends the recording and starts a job. Returns the provider's job id.
  abstract submit(audio: Readable): Promise<string>;

  abstract check(transcriptionId: string): Promise<TranscriptionStatus>;
}

// The provider refused the request for good (e.g. it cannot read the file).
// Retrying would not help, so the file fails at once.
export class TranscriptionRejectedError extends Error {}
