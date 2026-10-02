import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { JobQueue } from '../../../queue/job-queue.js';
import type { MeetingFileDto } from '../../dto/meeting-file.dto.js';
import { MeetingFilesRepository, withoutStorageKey } from '../../meeting-files.repository.js';
import {
  PROCESS_FILE_QUEUE,
  processFileOptions,
  type ProcessFileJob,
} from '../../processing/process-file-queue.js';
import { RetryMeetingFileCommand } from './retry-meeting-file.command.js';

// Sends a FAILED file back to the queue. Any other status answers 409.
@CommandHandler(RetryMeetingFileCommand)
export class RetryMeetingFileHandler implements ICommandHandler<RetryMeetingFileCommand> {
  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly queue: JobQueue,
  ) {}

  async execute({ fileId, meetingId, ownerId }: RetryMeetingFileCommand): Promise<MeetingFileDto> {
    const file =
      isUUID(fileId) && isUUID(meetingId)
        ? await this.files.findOneByOwner(fileId, meetingId, ownerId)
        : null;
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (!(await this.files.requeue(file.id))) {
      throw new ConflictException('Only a file whose processing failed can be retried');
    }
    await this.queue.send<ProcessFileJob>(
      PROCESS_FILE_QUEUE,
      { fileId: file.id },
      processFileOptions(file.id),
    );
    const requeued = await this.files.findOne(file.id);
    return withoutStorageKey(requeued ?? file);
  }
}
