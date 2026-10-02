import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FileStorage } from '../../../storage/file-storage.js';
import type { MeetingFileWithUrlsDto } from '../../dto/meeting-file-with-urls.dto.js';
import { MeetingFilesRepository, withoutStorageKey } from '../../meeting-files.repository.js';
import { ListMeetingFilesQuery } from './list-meeting-files.query.js';

export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

@QueryHandler(ListMeetingFilesQuery)
export class ListMeetingFilesHandler implements IQueryHandler<ListMeetingFilesQuery> {
  constructor(
    private readonly files: MeetingFilesRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute({ meetingId }: ListMeetingFilesQuery): Promise<MeetingFileWithUrlsDto[]> {
    const files = await this.files.findConfirmedByMeeting(meetingId);
    // Signing is local (no request to storage), so this stays cheap.
    return Promise.all(
      files.map(async (file) => {
        const sign = (downloadAs?: string) =>
          this.storage.presignDownload(file.storageKey, {
            contentType: file.mimeType,
            expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
            downloadAs,
          });
        const [playbackUrl, downloadUrl] = await Promise.all([sign(), sign(file.name)]);
        return { ...withoutStorageKey(file), playbackUrl, downloadUrl };
      }),
    );
  }
}
