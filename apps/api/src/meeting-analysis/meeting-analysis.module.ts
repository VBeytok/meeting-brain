import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { AnalysisScheduler } from './analysis-scheduler.js';
import { AnalyzeMeetingHandler } from './commands/analyze-meeting/analyze-meeting.handler.js';
import { RetryMeetingAnalysisHandler } from './commands/retry-meeting-analysis/retry-meeting-analysis.handler.js';
import { MeetingFilesChangedHandler } from './events/meeting-files-changed.handler.js';
import { MeetingAnalysisController } from './meeting-analysis.controller.js';
import { MeetingAnalysisProcessor } from './meeting-analysis-processor.js';
import { MeetingAnalysisRepository } from './meeting-analysis.repository.js';
import { GetMeetingAnalysisHandler } from './queries/get-meeting-analysis/get-meeting-analysis.handler.js';

// A meeting's summary, action items and decisions. Reaches meetings and
// their files only through the buses.
@Module({
  imports: [AnalysisModule, AuthModule, PrismaModule, QueueModule],
  controllers: [MeetingAnalysisController],
  providers: [
    MeetingAnalysisRepository,
    AnalysisScheduler,
    AnalyzeMeetingHandler,
    RetryMeetingAnalysisHandler,
    MeetingFilesChangedHandler,
    GetMeetingAnalysisHandler,
    MeetingAnalysisProcessor,
  ],
})
export class MeetingAnalysisModule {}
