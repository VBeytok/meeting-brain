import {
  AnalysisRejectedError,
  type Analysis,
  type AnalysisSource,
  MeetingAnalyzer,
} from './analyzer.js';

// A transcript containing this fails the analysis, so tests can exercise the
// failure path.
export const FAKE_FAILURE_MARKER = 'FAKE_ANALYSIS_FAILURE';

// Used when ANTHROPIC_API_KEY is unset: no network, no cost. Builds a canned
// analysis from what it is given, `delaySeconds` later.
export class FakeAnalyzer extends MeetingAnalyzer {
  constructor(private readonly delaySeconds: number) {
    super();
  }

  async analyze(sources: AnalysisSource[]): Promise<Analysis> {
    if (this.delaySeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delaySeconds * 1000));
    }
    const segments = sources.flatMap((source) => source.transcript.segments);
    if (segments.some((segment) => segment.text.includes(FAKE_FAILURE_MARKER))) {
      throw new AnalysisRejectedError('The fake analyzer was told to fail.');
    }
    const parts = sources.map((source) => source.name).join(', ');
    return {
      language: sources.find((source) => source.transcript.language)?.transcript.language ?? 'en',
      summary: `A fake summary of ${sources.length} part(s) (${parts}), ${segments.length} line(s) in all. It opens with: "${segments[0]?.text ?? ''}"`,
      actionItems: [
        { text: 'Open a ticket for slow large uploads', owner: 'Speaker B', dueDate: 'Friday' },
        { text: 'Share the meeting notes' },
      ],
      decisions: ['Look into upload speed next sprint'],
    };
  }
}
