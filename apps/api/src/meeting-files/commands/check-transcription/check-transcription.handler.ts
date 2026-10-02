import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MeetingFileStatus } from '../../../generated/prisma/client.js';
import { JobQueue } from '../../../queue/job-queue.js';
import { Transcriber } from '../../../transcription/transcriber.js';
import { MeetingFilesRepository } from '../../meeting-files.repository.js';
import {
  CHECK_TRANSCRIPTION_QUEUE,
  type CheckTranscriptionJob,
  MAX_TRANSCRIPTION_MS,
  POLL_SECONDS,
} from '../../processing/process-file-queue.js';
import { CheckTranscriptionCommand } from './check-transcription.command.js';

const UNEXPECTED = 'Transcription failed on our side. Try again.';

// Asks the provider once about a TRANSCRIBING recording: READY with the
// transcript, FAILED with the provider's reason, or another check later.
@CommandHandler(CheckTranscriptionCommand)
export class CheckTranscriptionHandler implements ICommandHandler<CheckTranscriptionCommand> {
  private readonly logger = new Logger(CheckTranscriptionHandler.name);

  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly transcriber: Transcriber,
    private readonly queue: JobQueue,
  ) {}

  async execute({ job, isLastAttempt }: CheckTranscriptionCommand): Promise<void> {
    const file = await this.files.findOne(job.fileId);
    // Deleted, finished, or retried since: a newer job owns it.
    if (
      !file ||
      file.status !== MeetingFileStatus.TRANSCRIBING ||
      file.transcriptionId !== job.transcriptionId
    ) {
      return;
    }

    try {
      const status = await this.transcriber.check(job.transcriptionId);
      if (status.state === 'failed') {
        await this.files.markFailed(file.id, `Transcription failed: ${status.error}`);
      } else if (status.state === 'completed') {
        if (status.transcript.segments.length === 0) {
          await this.files.markFailed(file.id, 'No speech was found in the recording.');
        } else {
          await this.files.markReady(file.id, status.transcript);
        }
      } else if (Date.now() - job.submittedAt > MAX_TRANSCRIPTION_MS) {
        await this.files.markFailed(file.id, 'Transcription took too long. Try again.');
      } else {
        await this.queue.send<CheckTranscriptionJob>(CHECK_TRANSCRIPTION_QUEUE, job, {
          startAfter: POLL_SECONDS,
        });
      }
    } catch (error) {
      this.logger.error(`Checking transcription of file ${file.id} failed`, error);
      if (isLastAttempt) {
        await this.files.markFailed(file.id, UNEXPECTED);
        return;
      }
      throw error;
    }
  }
}
