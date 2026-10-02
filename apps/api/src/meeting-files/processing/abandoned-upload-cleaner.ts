import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JobQueue } from '../../queue/job-queue.js';
import { CleanUpAbandonedUploadsCommand } from '../commands/clean-up-abandoned-uploads/clean-up-abandoned-uploads.command.js';

export const CLEAN_UP_QUEUE = 'meeting-file.clean-up';

// Every hour, on the hour (UTC).
const HOURLY = '0 * * * *';

// Runs the cleanup on a pg-boss cron schedule. The schedule lives in
// Postgres and fires once per tick however many API processes run.
@Injectable()
export class AbandonedUploadCleaner implements OnApplicationBootstrap {
  constructor(
    private readonly queue: JobQueue,
    private readonly commandBus: CommandBus,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.define(CLEAN_UP_QUEUE, {
      retryLimit: 2,
      retryDelaySeconds: 60,
      expireInSeconds: 10 * 60,
      concurrency: 1,
    });
    await this.queue.schedule(CLEAN_UP_QUEUE, HOURLY);
    await this.queue.work<object>(CLEAN_UP_QUEUE, async () => {
      await this.commandBus.execute(new CleanUpAbandonedUploadsCommand());
    });
  }
}
