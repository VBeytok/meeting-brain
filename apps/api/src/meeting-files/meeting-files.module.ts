import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { CheckTranscriptionHandler } from './commands/check-transcription/check-transcription.handler.js';
import { CleanUpAbandonedUploadsHandler } from './commands/clean-up-abandoned-uploads/clean-up-abandoned-uploads.handler.js';
import { CompleteMeetingFileUploadHandler } from './commands/complete-meeting-file-upload/complete-meeting-file-upload.handler.js';
import { CreateMeetingFileHandler } from './commands/create-meeting-file/create-meeting-file.handler.js';
import { DeleteMeetingFileHandler } from './commands/delete-meeting-file/delete-meeting-file.handler.js';
import { ProcessMeetingFileHandler } from './commands/process-meeting-file/process-meeting-file.handler.js';
import { RetryMeetingFileHandler } from './commands/retry-meeting-file/retry-meeting-file.handler.js';
import { MeetingFilesController } from './meeting-files.controller.js';
import { MeetingFilesRepository } from './meeting-files.repository.js';
import { AbandonedUploadCleaner } from './processing/abandoned-upload-cleaner.js';
import { FileOutcomes } from './processing/file-outcomes.js';
import { MeetingFileProcessor } from './processing/meeting-file-processor.js';
import { GetAnalysisInputHandler } from './queries/get-analysis-input/get-analysis-input.handler.js';
import { ListMeetingFilesHandler } from './queries/list-meeting-files/list-meeting-files.handler.js';

// Files attached to meetings. Reaches meetings only through the buses.
@Module({
  imports: [AuthModule, PrismaModule, QueueModule, StorageModule, TranscriptionModule],
  controllers: [MeetingFilesController],
  providers: [
    MeetingFilesRepository,
    CreateMeetingFileHandler,
    CompleteMeetingFileUploadHandler,
    DeleteMeetingFileHandler,
    ProcessMeetingFileHandler,
    CheckTranscriptionHandler,
    RetryMeetingFileHandler,
    FileOutcomes,
    CleanUpAbandonedUploadsHandler,
    AbandonedUploadCleaner,
    MeetingFileProcessor,
    ListMeetingFilesHandler,
    GetAnalysisInputHandler,
  ],
})
export class MeetingFilesModule {}
