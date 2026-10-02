import { Injectable } from '@nestjs/common';
import {
  type MeetingFile,
  type MeetingFileKind,
  MeetingFileStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MeetingFileDto } from './dto/meeting-file.dto.js';

type NewMeetingFile = {
  meetingId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: MeetingFileKind;
};

// The stored record, with the storage key the API keeps to itself.
export type StoredMeetingFile = MeetingFileDto & { storageKey: string };

const toDto = (file: MeetingFile): StoredMeetingFile => ({
  id: file.id,
  name: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  kind: file.kind,
  status: file.status,
  createdAt: file.createdAt.toISOString(),
  storageKey: file.storageKey,
});

export function withoutStorageKey(file: StoredMeetingFile): MeetingFileDto {
  const { id, name, mimeType, size, kind, status, createdAt } = file;
  return { id, name, mimeType, size, kind, status, createdAt };
}

// Data access for meeting_files. Reads on behalf of a user are scoped to the
// meeting's owner; the others take a meeting id the caller has already checked.
@Injectable()
export class MeetingFilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(file: NewMeetingFile): Promise<StoredMeetingFile> {
    return toDto(await this.prisma.meetingFile.create({ data: file }));
  }

  // Files that hold one of the meeting's slots: every confirmed upload, and
  // pending ones whose upload URL may still be in use. Older pending rows
  // are abandoned uploads, left for the cleanup job.
  countHoldingSlots(meetingId: string, pendingSince: Date): Promise<number> {
    return this.prisma.meetingFile.count({
      where: {
        meetingId,
        OR: [
          { status: { not: MeetingFileStatus.PENDING_UPLOAD } },
          { createdAt: { gte: pendingSince } },
        ],
      },
    });
  }

  // Confirmed uploads, oldest first. Pending ones are in flight and not shown.
  async findConfirmedByMeeting(meetingId: string): Promise<StoredMeetingFile[]> {
    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId, status: { not: MeetingFileStatus.PENDING_UPLOAD } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return files.map(toDto);
  }

  async findOneByOwner(
    id: string,
    meetingId: string,
    ownerId: string,
  ): Promise<StoredMeetingFile | null> {
    const file = await this.prisma.meetingFile.findFirst({
      where: { id, meetingId, meeting: { ownerId } },
    });
    return file && toDto(file);
  }

  // Moves a pending file to QUEUED. Returns null when it was no longer pending
  // (a concurrent complete got there first).
  async markQueued(id: string): Promise<StoredMeetingFile | null> {
    const { count } = await this.prisma.meetingFile.updateMany({
      where: { id, status: MeetingFileStatus.PENDING_UPLOAD },
      data: { status: MeetingFileStatus.QUEUED },
    });
    if (count === 0) return null;
    const file = await this.prisma.meetingFile.findUnique({ where: { id } });
    return file && toDto(file);
  }

  async findOne(id: string): Promise<StoredMeetingFile | null> {
    const file = await this.prisma.meetingFile.findUnique({ where: { id } });
    return file && toDto(file);
  }
}
