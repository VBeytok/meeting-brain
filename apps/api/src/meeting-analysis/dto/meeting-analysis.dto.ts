import type { ActionItem } from '../../analysis/analyzer.js';

export class MeetingAnalysisDto {
  // PENDING: files changed, a rebuild waits until none is still processing.
  // RUNNING: being written. READY. FAILED: `error` says why; retry it.
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';
  // The last successful build; kept while a rebuild is PENDING or RUNNING.
  // null before the first one.
  summary: string | null;
  actionItems: ActionItem[];
  decisions: string[];
  language: string | null;
  // FAILED files the last build left out.
  skippedFileIds: string[];
  error: string | null;
  // ISO 8601, when the last successful build finished.
  generatedAt: string | null;
}
