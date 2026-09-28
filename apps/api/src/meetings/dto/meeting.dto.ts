export class MeetingDto {
  id: string;
  title: string;
  // ISO 8601, UTC.
  date: string;
  participants: string[];
}
