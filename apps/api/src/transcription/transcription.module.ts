import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TranscriptionEnv } from '../config/transcription-env.js';
import { AssemblyAiTranscriber } from './assemblyai-transcriber.js';
import { FakeTranscriber } from './fake-transcriber.js';
import { Transcriber } from './transcriber.js';

// Provides Transcriber: AssemblyAI when ASSEMBLYAI_API_KEY is set, otherwise
// the fake (env validation refuses a missing key in production).
@Module({
  providers: [
    {
      provide: Transcriber,
      inject: [ConfigService],
      useFactory: (config: ConfigService<TranscriptionEnv, true>): Transcriber => {
        const key = config.get('ASSEMBLYAI_API_KEY', { infer: true });
        if (key !== null) {
          return new AssemblyAiTranscriber(key);
        }
        new Logger('TranscriptionModule').warn(
          'ASSEMBLYAI_API_KEY is not set: recordings get a canned fake transcript',
        );
        return new FakeTranscriber(config.get('FAKE_TRANSCRIPTION_DELAY_SECONDS', { infer: true }));
      },
    },
  ],
  exports: [Transcriber],
})
export class TranscriptionModule {}
