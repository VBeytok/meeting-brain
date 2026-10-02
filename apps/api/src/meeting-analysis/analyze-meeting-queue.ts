import type { QueueSettings } from '../queue/job-queue.js';

// Builds a meeting's analysis. Sent with singletonKey = meeting id on a
// stately queue: at most one job per meeting waits while another runs, so a
// burst of file changes collapses into one rebuild.
export const ANALYZE_MEETING_QUEUE = 'meeting.analyze';

export type AnalyzeMeetingJob = { meetingId: string };

export const ANALYZE_MEETING_SETTINGS: QueueSettings = {
  retryLimit: 3,
  retryDelaySeconds: 10,
  expireInSeconds: 10 * 60,
  concurrency: 2,
  policy: 'stately',
};

export const analyzeMeetingOptions = (meetingId: string) => ({ singletonKey: meetingId });
