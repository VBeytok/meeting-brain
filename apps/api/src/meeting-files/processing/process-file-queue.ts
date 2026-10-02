import type { QueueSettings } from '../../queue/job-queue.js';

// One job per confirmed file: a transcript file is parsed, a recording is
// sent to the transcription provider. A duplicate job is harmless: the
// handler acts only on a QUEUED file.
export const PROCESS_FILE_QUEUE = 'meeting-file.process';

export type ProcessFileJob = { fileId: string };

// Retries are for trouble on our side or the provider's (storage, database,
// network); a file that does not parse or that the provider refuses fails at
// once. Streaming a 1 GB recording to the provider can take a while.
export const PROCESS_FILE_SETTINGS: QueueSettings = {
  retryLimit: 3,
  retryDelaySeconds: 5,
  expireInSeconds: 30 * 60,
  concurrency: 4,
};

// Polls the provider for a TRANSCRIBING recording. Each job checks once and,
// while the provider is still working, sends the next one POLL_SECONDS later.
export const CHECK_TRANSCRIPTION_QUEUE = 'meeting-file.check-transcription';

export type CheckTranscriptionJob = {
  fileId: string;
  transcriptionId: string;
  // When the recording was submitted (ms since epoch), to give up eventually.
  submittedAt: number;
};

export const CHECK_TRANSCRIPTION_SETTINGS: QueueSettings = {
  retryLimit: 5,
  retryDelaySeconds: 10,
  expireInSeconds: 60,
  concurrency: 4,
};

export const POLL_SECONDS = 5;

// Providers finish within a fraction of the recording's length; this is far
// past that for a 1 GB file.
export const MAX_TRANSCRIPTION_MS = 6 * 60 * 60 * 1000;
