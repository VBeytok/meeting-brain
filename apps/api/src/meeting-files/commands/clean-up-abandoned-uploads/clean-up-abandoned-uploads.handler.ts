import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { FileStorage } from '../../../storage/file-storage.js';
import { MeetingFilesRepository } from '../../meeting-files.repository.js';
import { CleanUpAbandonedUploadsCommand } from './clean-up-abandoned-uploads.command.js';

// An upload URL is valid for 1 hour; a file still pending a day later is
// abandoned, with margin for a slow upload that completes late.
export const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

// Files handled per run. Hourly runs catch up on any backlog.
const BATCH = 500;

@CommandHandler(CleanUpAbandonedUploadsCommand)
export class CleanUpAbandonedUploadsHandler implements ICommandHandler<CleanUpAbandonedUploadsCommand> {
  private readonly logger = new Logger(CleanUpAbandonedUploadsHandler.name);

  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute({ now }: CleanUpAbandonedUploadsCommand): Promise<number> {
    const abandoned = await this.files.findAbandoned(
      new Date(now.getTime() - ABANDONED_AFTER_MS),
      BATCH,
    );
    let removed = 0;
    for (const file of abandoned) {
      try {
        // Object first, as when a user deletes a file: a failure leaves the row
        // for the next run instead of an object no row points to.
        await this.storage.delete(file.storageKey);
        // Only while still pending: a late complete keeps its file.
        if (await this.files.deletePending(file.id)) removed++;
      } catch (error) {
        // One bad file must not stop the rest.
        this.logger.error(`Cleaning up abandoned upload ${file.id} failed`, error);
      }
    }
    if (removed > 0) {
      this.logger.log(`Removed ${removed} abandoned upload(s)`);
    }
    return removed;
  }
}
