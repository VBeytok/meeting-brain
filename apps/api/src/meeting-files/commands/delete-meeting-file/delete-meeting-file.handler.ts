import { NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { MeetingFileStatus } from '../../../generated/prisma/client.js';
import { FileStorage } from '../../../storage/file-storage.js';
import { MeetingFilesChangedEvent } from '../../events/meeting-files-changed.event.js';
import { MeetingFilesRepository } from '../../meeting-files.repository.js';
import { DeleteMeetingFileCommand } from './delete-meeting-file.command.js';

// Deletes a file in any state, including a pending upload (that is how the
// web app's Cancel frees the slot).
@CommandHandler(DeleteMeetingFileCommand)
export class DeleteMeetingFileHandler implements ICommandHandler<DeleteMeetingFileCommand> {
  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly storage: FileStorage,
    private readonly events: EventBus,
  ) {}

  async execute({ fileId, meetingId, ownerId }: DeleteMeetingFileCommand): Promise<void> {
    const file =
      isUUID(fileId) && isUUID(meetingId)
        ? await this.files.findOneByOwner(fileId, meetingId, ownerId)
        : null;
    if (!file) {
      throw new NotFoundException('File not found');
    }
    // Object first: if the row delete then fails, a retry finds the row and
    // deleting the missing object again is a no-op. The other order could
    // leave an object no row points to.
    await this.storage.delete(file.storageKey);
    await this.files.delete(file.id);
    // A pending upload was never part of the meeting's processed files.
    if (file.status !== MeetingFileStatus.PENDING_UPLOAD) {
      this.events.publish(new MeetingFilesChangedEvent(file.meetingId));
    }
  }
}
