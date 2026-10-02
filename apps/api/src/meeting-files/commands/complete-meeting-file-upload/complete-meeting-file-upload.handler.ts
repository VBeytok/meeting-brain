import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { MeetingFileStatus } from '../../../generated/prisma/client.js';
import { JobQueue } from '../../../queue/job-queue.js';
import { FileStorage } from '../../../storage/file-storage.js';
import type { MeetingFileDto } from '../../dto/meeting-file.dto.js';
import { normalizeMimeType } from '../../file-types.js';
import { MeetingFilesRepository, withoutStorageKey } from '../../meeting-files.repository.js';
import { PROCESS_FILE_QUEUE, type ProcessFileJob } from '../../processing/process-file-queue.js';
import { CompleteMeetingFileUploadCommand } from './complete-meeting-file-upload.command.js';

// Confirms an upload: the object must be in storage with the size and type
// declared when the file was created. Calling it again on a confirmed file
// returns the file unchanged.
@CommandHandler(CompleteMeetingFileUploadCommand)
export class CompleteMeetingFileUploadHandler implements ICommandHandler<CompleteMeetingFileUploadCommand> {
  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly storage: FileStorage,
    private readonly queue: JobQueue,
  ) {}

  async execute({
    fileId,
    meetingId,
    ownerId,
  }: CompleteMeetingFileUploadCommand): Promise<MeetingFileDto> {
    const file =
      isUUID(fileId) && isUUID(meetingId)
        ? await this.files.findOneByOwner(fileId, meetingId, ownerId)
        : null;
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.status !== MeetingFileStatus.PENDING_UPLOAD) {
      return withoutStorageKey(file);
    }

    const object = await this.storage.head(file.storageKey);
    if (!object) {
      throw new ConflictException('The upload has not reached storage');
    }
    if (object.size !== file.size) {
      throw new ConflictException(
        `The uploaded file is ${object.size} bytes, but ${file.size} were declared`,
      );
    }
    if (normalizeMimeType(object.contentType) !== file.mimeType) {
      throw new ConflictException('The uploaded file does not have the declared type');
    }

    // null when a concurrent complete queued it first; that call sends the job.
    const queued = await this.files.markQueued(file.id);
    if (queued) {
      await this.queue.send<ProcessFileJob>(PROCESS_FILE_QUEUE, { fileId: queued.id });
    }
    return withoutStorageKey(queued ?? (await this.files.findOne(file.id)) ?? file);
  }
}
