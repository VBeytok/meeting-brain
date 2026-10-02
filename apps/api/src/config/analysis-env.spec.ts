import { validateAnalysisEnv } from './analysis-env.js';

describe('validateAnalysisEnv', () => {
  it('selects the fake when there is no key', () => {
    expect(validateAnalysisEnv({ ANTHROPIC_API_KEY: '' })).toEqual({
      ANTHROPIC_API_KEY: null,
      FAKE_ANALYSIS_DELAY_SECONDS: 0,
    });
  });

  it('requires a key in production', () => {
    expect(() => validateAnalysisEnv({ NODE_ENV: 'production' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(
      validateAnalysisEnv({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'k' }).ANTHROPIC_API_KEY,
    ).toBe('k');
  });

  it.each(['-1', 'soon'])('rejects FAKE_ANALYSIS_DELAY_SECONDS=%j', (value) => {
    expect(() => validateAnalysisEnv({ FAKE_ANALYSIS_DELAY_SECONDS: value })).toThrow(
      /FAKE_ANALYSIS_DELAY_SECONDS/,
    );
  });
});
