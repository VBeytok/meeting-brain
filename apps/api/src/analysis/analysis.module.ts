import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalysisEnv } from '../config/analysis-env.js';
import { MeetingAnalyzer } from './analyzer.js';
import { ClaudeAnalyzer } from './claude-analyzer.js';
import { FakeAnalyzer } from './fake-analyzer.js';

// Provides MeetingAnalyzer: Claude when ANTHROPIC_API_KEY is set, otherwise
// the fake (env validation refuses a missing key in production).
@Module({
  providers: [
    {
      provide: MeetingAnalyzer,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AnalysisEnv, true>): MeetingAnalyzer => {
        const key = config.get('ANTHROPIC_API_KEY', { infer: true });
        if (key !== null) {
          return new ClaudeAnalyzer(key);
        }
        new Logger('AnalysisModule').warn(
          'ANTHROPIC_API_KEY is not set: meetings get a canned fake analysis',
        );
        return new FakeAnalyzer(config.get('FAKE_ANALYSIS_DELAY_SECONDS', { infer: true }));
      },
    },
  ],
  exports: [MeetingAnalyzer],
})
export class AnalysisModule {}
