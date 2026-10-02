import { Readable } from 'node:stream';
import type { TranscriptSegment } from '../meeting-files/transcripts/transcript.js';
import {
  Transcriber,
  TranscriptionRejectedError,
  type TranscriptionStatus,
} from './transcriber.js';

const API = 'https://api.assemblyai.com/v2';

type Utterance = { speaker: string; start: number; end: number; text: string };
type TranscriptResponse = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error?: string | null;
  language_code?: string | null;
  text?: string | null;
  utterances?: Utterance[] | null;
};

// AssemblyAI over its REST API. The recording is streamed from storage to the
// upload endpoint, so storage never has to be reachable from the internet,
// and AssemblyAI accepts video as is. Speakers come back as A, B, …; times in
// milliseconds.
export class AssemblyAiTranscriber extends Transcriber {
  constructor(private readonly apiKey: string) {
    super();
  }

  async submit(audio: Readable): Promise<string> {
    const { upload_url } = await this.request<{ upload_url: string }>('/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Readable.toWeb(audio) as ReadableStream<Uint8Array>,
      duplex: 'half',
    });
    const job = await this.request<TranscriptResponse>('/transcript', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        language_detection: true,
      }),
    });
    return job.id;
  }

  async check(transcriptionId: string): Promise<TranscriptionStatus> {
    const job = await this.request<TranscriptResponse>(
      `/transcript/${encodeURIComponent(transcriptionId)}`,
      { method: 'GET' },
    );
    if (job.status === 'error') {
      return { state: 'failed', error: job.error ?? 'The provider gave no reason.' };
    }
    if (job.status !== 'completed') {
      return { state: 'processing' };
    }
    return {
      state: 'completed',
      transcript: { language: job.language_code ?? null, segments: segments(job) },
    };
  }

  // A 4xx other than auth and rate limits is the provider refusing this
  // request; anything else (network, 5xx, our key) is thrown to be retried.
  private async request<T>(path: string, init: RequestInit & { duplex?: 'half' }): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: this.apiKey },
    });
    if (response.ok) {
      return (await response.json()) as T;
    }
    const detail = await errorMessage(response);
    const status = response.status;
    if (status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status)) {
      throw new TranscriptionRejectedError(detail);
    }
    throw new Error(`AssemblyAI ${init.method} ${path} answered ${status}: ${detail}`);
  }
}

function segments(job: TranscriptResponse): TranscriptSegment[] {
  if (job.utterances?.length) {
    return job.utterances.map((utterance) => ({
      start: utterance.start / 1000,
      end: utterance.end / 1000,
      speaker: `Speaker ${utterance.speaker}`,
      text: utterance.text,
    }));
  }
  // Without speech there are no utterances, and no text either.
  const text = job.text?.trim();
  return text ? [{ text }] : [];
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
