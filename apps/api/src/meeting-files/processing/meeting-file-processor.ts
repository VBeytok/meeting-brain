import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JobQueue } from '../../queue/job-queue.js';
import { CheckTranscriptionCommand } from '../commands/check-transcription/check-transcription.command.js';
import { ProcessMeetingFileCommand } from '../commands/process-meeting-file/process-meeting-file.command.js';
import {
  CHECK_TRANSCRIPTION_QUEUE,
  CHECK_TRANSCRIPTION_SETTINGS,
  type CheckTranscriptionJob,
  PROCESS_FILE_QUEUE,
  PROCESS_FILE_SETTINGS,
  type ProcessFileJob,
} from './process-file-queue.js';

// Works the processing queues: each job becomes a command.
@Injectable()
export class MeetingFileProcessor implements OnApplicationBootstrap {
  constructor(
    private readonly queue: JobQueue,
    private readonly commandBus: CommandBus,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.define(PROCESS_FILE_QUEUE, PROCESS_FILE_SETTINGS);
    await this.queue.define(CHECK_TRANSCRIPTION_QUEUE, CHECK_TRANSCRIPTION_SETTINGS);
    await this.queue.work<ProcessFileJob>(PROCESS_FILE_QUEUE, ({ data, isLastAttempt }) =>
      this.commandBus.execute(new ProcessMeetingFileCommand(data.fileId, isLastAttempt)),
    );
    await this.queue.work<CheckTranscriptionJob>(
      CHECK_TRANSCRIPTION_QUEUE,
      ({ data, isLastAttempt }) =>
        this.commandBus.execute(new CheckTranscriptionCommand(data, isLastAttempt)),
    );
  }
}
