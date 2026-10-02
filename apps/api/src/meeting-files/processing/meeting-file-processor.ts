import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JobQueue } from '../../queue/job-queue.js';
import { ProcessMeetingFileCommand } from '../commands/process-meeting-file/process-meeting-file.command.js';
import {
  PROCESS_FILE_QUEUE,
  PROCESS_FILE_SETTINGS,
  type ProcessFileJob,
} from './process-file-queue.js';

// Works the processing queue. Each job becomes a ProcessMeetingFileCommand.
@Injectable()
export class MeetingFileProcessor implements OnApplicationBootstrap {
  constructor(
    private readonly queue: JobQueue,
    private readonly commandBus: CommandBus,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.define(PROCESS_FILE_QUEUE, PROCESS_FILE_SETTINGS);
    await this.queue.work<ProcessFileJob>(PROCESS_FILE_QUEUE, ({ data, isLastAttempt }) =>
      this.commandBus.execute(new ProcessMeetingFileCommand(data.fileId, isLastAttempt)),
    );
  }
}
