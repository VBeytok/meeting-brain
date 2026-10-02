import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MeetingFileKind, MeetingFileStatus } from '../../../generated/prisma/client.js';
import { JobQueue } from '../../../queue/job-queue.js';
import { FileStorage } from '../../../storage/file-storage.js';
import { Transcriber, TranscriptionRejectedError } from '../../../transcription/transcriber.js';
import { FileOutcomes } from '../../processing/file-outcomes.js';
import { MeetingFilesRepository, type StoredMeetingFile } from '../../meeting-files.repository.js';
import {
  CHECK_TRANSCRIPTION_QUEUE,
  type CheckTranscriptionJob,
} from '../../processing/process-file-queue.js';
import { parseTranscript } from '../../transcripts/parse-transcript.js';
import { TranscriptParseError } from '../../transcripts/transcript.js';
import { ProcessMeetingFileCommand } from './process-meeting-file.command.js';

// Transcripts are read whole into memory; anything this big is not a transcript.
export const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024;

const UNEXPECTED = 'Processing failed on our side. Try again.';
const MISSING = 'The uploaded file is missing from storage.';

// Processes a QUEUED file. A transcript file is parsed into READY (with its
// transcript) or FAILED (with a reason). A recording is streamed to the
// transcription provider and becomes TRANSCRIBING; CheckTranscriptionCommand
// polls it from there. Throws on trouble worth retrying; the queue retries it.
@CommandHandler(ProcessMeetingFileCommand)
export class ProcessMeetingFileHandler implements ICommandHandler<ProcessMeetingFileCommand> {
  private readonly logger = new Logger(ProcessMeetingFileHandler.name);

  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly outcomes: FileOutcomes,
    private readonly storage: FileStorage,
    private readonly transcriber: Transcriber,
    private readonly queue: JobQueue,
  ) {}

  async execute({ fileId, isLastAttempt }: ProcessMeetingFileCommand): Promise<void> {
    const file = await this.files.findOne(fileId);
    // Deleted, or already processed.
    if (!file || file.status !== MeetingFileStatus.QUEUED) return;

    try {
      if (file.kind === MeetingFileKind.TRANSCRIPT) {
        await this.parse(file);
      } else {
        await this.submit(file);
      }
    } catch (error) {
      if (error instanceof TranscriptParseError) {
        await this.outcomes.failed(file, error.message);
        return;
      }
      if (error instanceof TranscriptionRejectedError) {
        await this.outcomes.failed(file, `Transcription failed: ${error.message}`);
        return;
      }
      this.logger.error(`Processing file ${file.id} failed`, error);
      if (isLastAttempt) {
        await this.outcomes.failed(file, UNEXPECTED);
        return;
      }
      throw error;
    }
  }

  private async parse(file: StoredMeetingFile): Promise<void> {
    if (file.size > MAX_TRANSCRIPT_BYTES) {
      throw new TranscriptParseError('Transcript files over 20 MB cannot be read.');
    }
    const bytes = await this.storage.read(file.storageKey);
    if (!bytes) {
      throw new TranscriptParseError(MISSING);
    }
    const transcript = parseTranscript(file.name, decodeUtf8(bytes));
    await this.outcomes.ready(file, transcript);
  }

  private async submit(file: StoredMeetingFile): Promise<void> {
    const audio = await this.storage.openRead(file.storageKey);
    if (!audio) {
      await this.outcomes.failed(file, MISSING);
      return;
    }
    const transcriptionId = await this.transcriber.submit(audio);
    // False when the file was deleted while it uploaded; the provider's job
    // is then left to finish unread.
    if (!(await this.files.markTranscribing(file.id, transcriptionId))) return;
    await this.queue.send<CheckTranscriptionJob>(CHECK_TRANSCRIPTION_QUEUE, {
      fileId: file.id,
      transcriptionId,
      submittedAt: Date.now(),
    });
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TranscriptParseError('The file is not UTF-8 text.');
  }
}
