import { ArrayMaxSize, IsArray, IsISO8601, IsString, Matches, MaxLength } from 'class-validator';

// A full date-time with an explicit offset. IsISO8601 alone also accepts week and
// ordinal dates, which `new Date` cannot parse, and offset-less times, which it
// reads in the server's timezone.
// Rejects empty and whitespace-only strings.
const NOT_BLANK = /\S/;

const DATE_TIME_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export class CreateMeetingDto {
  @IsString()
  @Matches(NOT_BLANK, { message: 'title must not be blank' })
  @MaxLength(200)
  title: string;

  @IsISO8601({ strict: true })
  @Matches(DATE_TIME_WITH_OFFSET, { message: 'date must be an ISO 8601 date-time with an offset' })
  date: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(NOT_BLANK, { each: true, message: 'each value in participants must not be blank' })
  @MaxLength(254, { each: true })
  participants: string[];
}
