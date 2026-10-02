import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MeetingFileKind, MeetingFileStatus } from '../../../generated/prisma/client.js';
import { FileStorage } from '../../../storage/file-storage.js';
import { MeetingFilesRepository } from '../../meeting-files.repository.js';
import { parseTranscript } from '../../transcripts/parse-transcript.js';
import { TranscriptParseError } from '../../transcripts/transcript.js';
import { ProcessMeetingFileCommand } from './process-meeting-file.command.js';

// Transcripts are read whole into memory; anything this big is not a transcript.
export const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024;

const UNEXPECTED = 'Processing failed on our side. Try again.';

// Parses a QUEUED transcript file into READY (with its transcript) or FAILED
// (with a reason). Throws on trouble worth retrying; the queue retries it.
@CommandHandler(ProcessMeetingFileCommand)
export class ProcessMeetingFileHandler implements ICommandHandler<ProcessMeetingFileCommand> {
  private readonly logger = new Logger(ProcessMeetingFileHandler.name);

  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute({ fileId, isLastAttempt }: ProcessMeetingFileCommand): Promise<void> {
    const file = await this.files.findOne(fileId);
    // Deleted, already processed, or not ours to process yet.
    if (!file || file.status !== MeetingFileStatus.QUEUED) return;
    if (file.kind !== MeetingFileKind.TRANSCRIPT) return;

    try {
      if (file.size > MAX_TRANSCRIPT_BYTES) {
        throw new TranscriptParseError('Transcript files over 20 MB cannot be read.');
      }
      const bytes = await this.storage.read(file.storageKey);
      if (!bytes) {
        throw new TranscriptParseError('The uploaded file is missing from storage.');
      }
      const transcript = parseTranscript(file.name, decodeUtf8(bytes));
      await this.files.markReady(file.id, transcript);
    } catch (error) {
      if (error instanceof TranscriptParseError) {
        await this.files.markFailed(file.id, error.message);
        return;
      }
      this.logger.error(`Processing file ${file.id} failed`, error);
      if (isLastAttempt) {
        await this.files.markFailed(file.id, UNEXPECTED);
        return;
      }
      throw error;
    }
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TranscriptParseError('The file is not UTF-8 text.');
  }
}
