import type { Transcript } from '../meeting-files/transcripts/transcript.js';

// One processed file of the meeting, in upload order.
export type AnalysisSource = { name: string; transcript: Transcript };

export type ActionItem = {
  text: string;
  // Who owns it and when it is due, as said in the meeting. Absent when not mentioned.
  owner?: string;
  dueDate?: string;
};

export type Analysis = {
  // BCP 47 tag of the meeting's language, which the rest is written in.
  language: string;
  summary: string;
  actionItems: ActionItem[];
  decisions: string[];
};

// Writes a meeting's summary, action items and decisions from its
// transcripts, in the meeting's language. An abstract class rather than an
// interface so it can be the injection token.
export abstract class MeetingAnalyzer {
  abstract analyze(sources: AnalysisSource[]): Promise<Analysis>;
}

// The analyzer refused this input for good (e.g. too long). Retrying would
// not help, so the analysis fails at once.
export class AnalysisRejectedError extends Error {}
