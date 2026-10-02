import type { Readable } from 'node:stream';
import { Transcriber, type TranscriptionStatus } from './transcriber.js';

// A recording whose bytes start with this fails transcription, so tests can
// exercise the failure path and recover by replacing the object.
export const FAKE_FAILURE_MARKER = 'FAKE_TRANSCRIPTION_FAILURE';

const CANNED_SEGMENTS = [
  { start: 0, end: 4, speaker: 'Speaker A', text: 'Thanks for joining. Shall we start?' },
  { start: 4, end: 9, speaker: 'Speaker B', text: 'Yes. The upload page shipped last week.' },
  { start: 9, end: 14, speaker: 'Speaker A', text: 'Great. Any feedback from users so far?' },
  { start: 14, end: 20, speaker: 'Speaker B', text: 'Mostly good. Large files were slow.' },
  { start: 20, end: 25, speaker: 'Speaker A', text: "Let's look into that next sprint." },
  { start: 25, end: 30, speaker: 'Speaker B', text: 'Agreed. I will open a ticket.' },
];

// Used when ASSEMBLYAI_API_KEY is unset: no network, no cost. Returns a canned
// transcript `delaySeconds` after submit. Stateless, so any API process can
// check a job another one submitted: the job id carries the outcome and when
// it is due.
export class FakeTranscriber extends Transcriber {
  constructor(private readonly delaySeconds: number) {
    super();
  }

  async submit(audio: Readable): Promise<string> {
    const head = await firstBytes(audio, FAKE_FAILURE_MARKER.length);
    const outcome = head === FAKE_FAILURE_MARKER ? 'fail' : 'ok';
    return `fake:${outcome}:${Date.now() + this.delaySeconds * 1000}`;
  }

  check(transcriptionId: string): Promise<TranscriptionStatus> {
    const [, outcome, dueAt] = transcriptionId.split(':');
    if (Date.now() < Number(dueAt)) {
      return Promise.resolve({ state: 'processing' });
    }
    return Promise.resolve(
      outcome === 'fail'
        ? { state: 'failed', error: 'The fake transcriber was told to fail.' }
        : { state: 'completed', transcript: { language: 'en', segments: CANNED_SEGMENTS } },
    );
  }
}

// Reads the first `length` bytes as text and drops the rest of the stream.
async function firstBytes(stream: Readable, length: number): Promise<string> {
  const chunks: Buffer[] = [];
  let read = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk as Uint8Array);
    chunks.push(buffer);
    read += buffer.length;
    if (read >= length) break;
  }
  stream.destroy();
  return Buffer.concat(chunks).subarray(0, length).toString('latin1');
}
