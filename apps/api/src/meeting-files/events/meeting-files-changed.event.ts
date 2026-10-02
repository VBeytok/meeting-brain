// A meeting's set of processed files changed: a file reached READY or
// FAILED, or a confirmed file was deleted. The analysis listens for it.
export class MeetingFilesChangedEvent {
  constructor(readonly meetingId: string) {}
}
