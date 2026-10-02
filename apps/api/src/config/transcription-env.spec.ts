import { validateTranscriptionEnv } from './transcription-env.js';

describe('validateTranscriptionEnv', () => {
  it('selects the fake when there is no key', () => {
    expect(validateTranscriptionEnv({})).toEqual({
      ASSEMBLYAI_API_KEY: null,
      FAKE_TRANSCRIPTION_DELAY_SECONDS: 0,
    });
    expect(validateTranscriptionEnv({ ASSEMBLYAI_API_KEY: '' }).ASSEMBLYAI_API_KEY).toBeNull();
  });

  it('keeps a key', () => {
    expect(validateTranscriptionEnv({ ASSEMBLYAI_API_KEY: 'k' }).ASSEMBLYAI_API_KEY).toBe('k');
  });

  it('requires a key in production', () => {
    expect(() => validateTranscriptionEnv({ NODE_ENV: 'production' })).toThrow(
      /ASSEMBLYAI_API_KEY/,
    );
    expect(
      validateTranscriptionEnv({ NODE_ENV: 'production', ASSEMBLYAI_API_KEY: 'k' })
        .ASSEMBLYAI_API_KEY,
    ).toBe('k');
  });

  it('reads the fake delay in seconds', () => {
    expect(
      validateTranscriptionEnv({ FAKE_TRANSCRIPTION_DELAY_SECONDS: '2.5' })
        .FAKE_TRANSCRIPTION_DELAY_SECONDS,
    ).toBe(2.5);
  });

  it.each(['-1', 'soon'])('rejects FAKE_TRANSCRIPTION_DELAY_SECONDS=%j', (value) => {
    expect(() => validateTranscriptionEnv({ FAKE_TRANSCRIPTION_DELAY_SECONDS: value })).toThrow(
      /FAKE_TRANSCRIPTION_DELAY_SECONDS/,
    );
  });
});
