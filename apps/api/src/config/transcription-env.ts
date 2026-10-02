// Transcription of recordings: AssemblyAI with a key, a fake without one.
export type TranscriptionEnv = {
  // null selects FakeTranscriber. Required in production.
  ASSEMBLYAI_API_KEY: string | null;
  // How long FakeTranscriber takes before its transcript is ready.
  FAKE_TRANSCRIPTION_DELAY_SECONDS: number;
};

export function validateTranscriptionEnv(raw: Record<string, unknown>): TranscriptionEnv {
  const key = isSet(raw.ASSEMBLYAI_API_KEY) ? (raw.ASSEMBLYAI_API_KEY as string) : null;
  if (key === null && raw.NODE_ENV === 'production') {
    throw new Error('ASSEMBLYAI_API_KEY is required in production');
  }

  const delay = isSet(raw.FAKE_TRANSCRIPTION_DELAY_SECONDS)
    ? Number(raw.FAKE_TRANSCRIPTION_DELAY_SECONDS)
    : 0;
  if (!Number.isFinite(delay) || delay < 0) {
    throw new Error('FAKE_TRANSCRIPTION_DELAY_SECONDS must be a number of seconds, 0 or more');
  }

  return { ASSEMBLYAI_API_KEY: key, FAKE_TRANSCRIPTION_DELAY_SECONDS: delay };
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== '';
}
