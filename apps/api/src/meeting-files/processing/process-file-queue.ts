import type { QueueSettings } from '../../queue/job-queue.js';

// One job per confirmed file that needs processing. Today: transcript files,
// parsed into segments. Recordings join in #16 (transcription).
export const PROCESS_FILE_QUEUE = 'meeting-file.process';

export type ProcessFileJob = { fileId: string };

// Retries are for trouble on our side (storage or the database unreachable);
// a file that does not parse fails at once.
export const PROCESS_FILE_SETTINGS: QueueSettings = {
  retryLimit: 3,
  retryDelaySeconds: 5,
  expireInSeconds: 5 * 60,
};

// singletonKey: one pending job per file, whoever sends it.
export const processFileOptions = (fileId: string) => ({ singletonKey: fileId });
