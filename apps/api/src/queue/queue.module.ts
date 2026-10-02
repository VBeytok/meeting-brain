import { Module } from '@nestjs/common';
import { JobQueue } from './job-queue.js';

@Module({
  providers: [JobQueue],
  exports: [JobQueue],
})
export class QueueModule {}
