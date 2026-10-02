import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { MeetingFilesChangedEvent } from '../events/meeting-files-changed.event.js';
import { MeetingFilesRepository, type StoredMeetingFile } from '../meeting-files.repository.js';
import type { Transcript } from '../transcripts/transcript.js';

// Ends a file's processing, READY or FAILED, and tells the rest of the app
// when that changed something.
@Injectable()
export class FileOutcomes {
  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly events: EventBus,
  ) {}

  async ready(file: StoredMeetingFile, transcript: Transcript): Promise<void> {
    if (await this.files.markReady(file.id, transcript)) {
      this.events.publish(new MeetingFilesChangedEvent(file.meetingId));
    }
  }

  async failed(file: StoredMeetingFile, error: string): Promise<void> {
    if (await this.files.markFailed(file.id, error)) {
      this.events.publish(new MeetingFilesChangedEvent(file.meetingId));
    }
  }
}
