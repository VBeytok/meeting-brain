import { Command } from '@nestjs/cqrs';
import type { CreatedUploadDto } from '../../dto/created-upload.dto.js';

export class CreateMeetingFileCommand extends Command<CreatedUploadDto> {
  constructor(
    readonly meetingId: string,
    readonly ownerId: string,
    readonly name: string,
    readonly mimeType: string,
    readonly size: number,
  ) {
    super();
  }
}
