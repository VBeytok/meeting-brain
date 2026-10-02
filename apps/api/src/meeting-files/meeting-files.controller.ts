import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CompleteMeetingFileUploadCommand } from './commands/complete-meeting-file-upload/complete-meeting-file-upload.command.js';
import { CreateMeetingFileCommand } from './commands/create-meeting-file/create-meeting-file.command.js';
import { DeleteMeetingFileCommand } from './commands/delete-meeting-file/delete-meeting-file.command.js';
import { CreateMeetingFileDto } from './dto/create-meeting-file.dto.js';
import type { CreatedUploadDto } from './dto/created-upload.dto.js';
import type { MeetingFileDto } from './dto/meeting-file.dto.js';

// Two-phase upload: create the file (get a presigned URL), PUT the bytes to
// storage from the browser, then complete.
@Controller('meetings/:meetingId/files')
@UseGuards(JwtAuthGuard)
export class MeetingFilesController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Body() { name, mimeType, size }: CreateMeetingFileDto,
  ): Promise<CreatedUploadDto> {
    return this.commandBus.execute(
      new CreateMeetingFileCommand(meetingId, user.id, name, mimeType, size),
    );
  }

  @Post(':fileId/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
  ): Promise<MeetingFileDto> {
    return this.commandBus.execute(
      new CompleteMeetingFileUploadCommand(fileId, meetingId, user.id),
    );
  }

  // Removes the file and its stored object, in any state.
  @Delete(':fileId')
  @HttpCode(204)
  delete(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteMeetingFileCommand(fileId, meetingId, user.id));
  }
}
