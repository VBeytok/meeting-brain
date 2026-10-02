import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { MeetingFileStatus } from '../../../generated/prisma/client.js';
import { UPLOAD_URL_TTL_SECONDS } from '../../commands/create-meeting-file/create-meeting-file.handler.js';
import { MeetingFilesRepository } from '../../meeting-files.repository.js';
import { type AnalysisInput, GetAnalysisInputQuery } from './get-analysis-input.query.js';

@QueryHandler(GetAnalysisInputQuery)
export class GetAnalysisInputHandler implements IQueryHandler<GetAnalysisInputQuery> {
  constructor(private readonly files: MeetingFilesRepository) {}

  async execute({ meetingId }: GetAnalysisInputQuery): Promise<AnalysisInput> {
    const files = await this.files.findAllByMeeting(meetingId);
    // A pending upload whose URL has expired can never complete; it waits for
    // the cleanup job instead of holding up the analysis.
    const pendingSince = Date.now() - UPLOAD_URL_TTL_SECONDS * 1000;
    const inProgress = files.some(
      (file) =>
        file.status === MeetingFileStatus.QUEUED ||
        file.status === MeetingFileStatus.TRANSCRIBING ||
        (file.status === MeetingFileStatus.PENDING_UPLOAD &&
          Date.parse(file.createdAt) >= pendingSince),
    );
    return {
      inProgress,
      ready: files
        .filter((file) => file.status === MeetingFileStatus.READY && file.transcript !== null)
        .map((file) => ({ id: file.id, name: file.name, transcript: file.transcript! })),
      failedIds: files
        .filter((file) => file.status === MeetingFileStatus.FAILED)
        .map((file) => file.id),
    };
  }
}
