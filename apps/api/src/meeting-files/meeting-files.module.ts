import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { CompleteMeetingFileUploadHandler } from './commands/complete-meeting-file-upload/complete-meeting-file-upload.handler.js';
import { CreateMeetingFileHandler } from './commands/create-meeting-file/create-meeting-file.handler.js';
import { DeleteMeetingFileHandler } from './commands/delete-meeting-file/delete-meeting-file.handler.js';
import { ProcessMeetingFileHandler } from './commands/process-meeting-file/process-meeting-file.handler.js';
import { RetryMeetingFileHandler } from './commands/retry-meeting-file/retry-meeting-file.handler.js';
import { MeetingFilesController } from './meeting-files.controller.js';
import { MeetingFilesRepository } from './meeting-files.repository.js';
import { MeetingFileProcessor } from './processing/meeting-file-processor.js';
import { ListMeetingFilesHandler } from './queries/list-meeting-files/list-meeting-files.handler.js';

// Files attached to meetings. Reaches meetings only through the buses.
@Module({
  imports: [AuthModule, PrismaModule, QueueModule, StorageModule],
  controllers: [MeetingFilesController],
  providers: [
    MeetingFilesRepository,
    CreateMeetingFileHandler,
    CompleteMeetingFileUploadHandler,
    DeleteMeetingFileHandler,
    ProcessMeetingFileHandler,
    RetryMeetingFileHandler,
    MeetingFileProcessor,
    ListMeetingFilesHandler,
  ],
})
export class MeetingFilesModule {}
