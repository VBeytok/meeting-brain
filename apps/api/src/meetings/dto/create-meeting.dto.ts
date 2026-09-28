import { IsArray, IsISO8601, IsNotEmpty, IsString, Matches } from 'class-validator';

// A full date-time with an explicit offset. IsISO8601 alone also accepts week and
// ordinal dates, which `new Date` cannot parse, and offset-less times, which it
// reads in the server's timezone.
const DATE_TIME_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsISO8601({ strict: true })
  @Matches(DATE_TIME_WITH_OFFSET, { message: 'date must be an ISO 8601 date-time with an offset' })
  date: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  participants: string[];
}
