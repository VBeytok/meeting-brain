import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_FILE_SIZE } from '../file-types.js';

const NOT_BLANK = /\S/;

// Describes a file the browser is about to upload. The bytes go straight to
// storage through the presigned URL in the response.
export class CreateMeetingFileDto {
  @IsString()
  @Matches(NOT_BLANK, { message: 'name must not be blank' })
  @MaxLength(255)
  name: string;

  // The browser's File.type. Often empty (e.g. for .srt); the extension decides.
  @IsString()
  @MaxLength(255)
  mimeType: string;

  @IsInt()
  @Min(1, { message: 'size must be at least 1 byte' })
  @Max(MAX_FILE_SIZE, { message: 'size must be at most 1 GB' })
  size: number;
}
