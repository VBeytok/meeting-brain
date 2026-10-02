// Meeting analysis (summary, action items, decisions): Claude with a key, a
// fake without one.
export type AnalysisEnv = {
  // null selects FakeAnalyzer. Required in production.
  ANTHROPIC_API_KEY: string | null;
  // How long FakeAnalyzer takes.
  FAKE_ANALYSIS_DELAY_SECONDS: number;
};

export function validateAnalysisEnv(raw: Record<string, unknown>): AnalysisEnv {
  const key = isSet(raw.ANTHROPIC_API_KEY) ? (raw.ANTHROPIC_API_KEY as string) : null;
  if (key === null && raw.NODE_ENV === 'production') {
    throw new Error('ANTHROPIC_API_KEY is required in production');
  }

  const delay = isSet(raw.FAKE_ANALYSIS_DELAY_SECONDS)
    ? Number(raw.FAKE_ANALYSIS_DELAY_SECONDS)
    : 0;
  if (!Number.isFinite(delay) || delay < 0) {
    throw new Error('FAKE_ANALYSIS_DELAY_SECONDS must be a number of seconds, 0 or more');
  }

  return { ANTHROPIC_API_KEY: key, FAKE_ANALYSIS_DELAY_SECONDS: delay };
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== '';
}
