import { IsArray, IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsISO8601({ strict: true })
  date: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  participants: string[];
}
