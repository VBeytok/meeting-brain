import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { GetMeetingQuery } from '../../../meetings/queries/get-meeting/get-meeting.query.js';
import { FileStorage } from '../../../storage/file-storage.js';
import type { CreatedUploadDto } from '../../dto/created-upload.dto.js';
import { ALLOWED_EXTENSIONS, classifyFile, MAX_FILES_PER_MEETING } from '../../file-types.js';
import { MeetingFilesRepository, withoutStorageKey } from '../../meeting-files.repository.js';
import { CreateMeetingFileCommand } from './create-meeting-file.command.js';

export const UPLOAD_URL_TTL_SECONDS = 60 * 60;

@CommandHandler(CreateMeetingFileCommand)
export class CreateMeetingFileHandler implements ICommandHandler<CreateMeetingFileCommand> {
  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly storage: FileStorage,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    meetingId,
    ownerId,
    name,
    mimeType,
    size,
  }: CreateMeetingFileCommand): Promise<CreatedUploadDto> {
    // 404 unless the caller owns the meeting.
    await this.queryBus.execute(new GetMeetingQuery(meetingId, ownerId));

    const originalName = baseName(name);
    const type = classifyFile(originalName, mimeType);
    if (!type) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}`,
      );
    }

    const pendingSince = new Date(Date.now() - UPLOAD_URL_TTL_SECONDS * 1000);
    if ((await this.files.countHoldingSlots(meetingId, pendingSince)) >= MAX_FILES_PER_MEETING) {
      throw new ConflictException(`A meeting can have up to ${MAX_FILES_PER_MEETING} files`);
    }

    // Named by a random id, not the file name: keys stay ASCII and unique, and
    // the prefix holds all of the meeting's objects.
    const storageKey = `meetings/${meetingId}/${randomUUID()}`;
    const file = await this.files.create({
      meetingId,
      storageKey,
      originalName,
      mimeType: type.mimeType,
      size,
      kind: type.kind,
    });
    const uploadUrl = await this.storage.presignUpload(
      storageKey,
      type.mimeType,
      UPLOAD_URL_TTL_SECONDS,
    );
    return {
      file: withoutStorageKey(file),
      uploadUrl,
      uploadHeaders: { 'Content-Type': type.mimeType },
    };
  }
}

// Some browsers send a full path ("C:\fakepath\a.mp3"); keep the last segment.
function baseName(name: string): string {
  return name.split(/[/\\]/).pop()!.trim();
}
