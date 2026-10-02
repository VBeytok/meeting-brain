import { Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { MeetingFilesChangedEvent } from '../../meeting-files/events/meeting-files-changed.event.js';
import { AnalysisScheduler } from '../analysis-scheduler.js';

// Rebuilds the analysis whenever the meeting's processed files change.
@EventsHandler(MeetingFilesChangedEvent)
export class MeetingFilesChangedHandler implements IEventHandler<MeetingFilesChangedEvent> {
  private readonly logger = new Logger(MeetingFilesChangedHandler.name);

  constructor(private readonly scheduler: AnalysisScheduler) {}

  // Events are fire-and-forget: a failure is logged, not thrown at whoever
  // changed the file.
  async handle({ meetingId }: MeetingFilesChangedEvent): Promise<void> {
    try {
      await this.scheduler.schedule(meetingId);
    } catch (error) {
      this.logger.error(`Scheduling the analysis of meeting ${meetingId} failed`, error);
    }
  }
}
