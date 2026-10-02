import { Query } from '@nestjs/cqrs';
import type { Transcript } from '../../transcripts/transcript.js';

export type AnalysisInput = {
  // Some file is still uploading, queued or transcribing: wait for it.
  inProgress: boolean;
  // READY files with their transcripts, in upload order.
  ready: { id: string; name: string; transcript: Transcript }[];
  // FAILED files, left out of the analysis.
  failedIds: string[];
};

// What a meeting's analysis is built from. Not scoped to an owner: for the
// background job, which has no caller.
export class GetAnalysisInputQuery extends Query<AnalysisInput> {
  constructor(readonly meetingId: string) {
    super();
  }
}
