import { Injectable } from '@nestjs/common';
import {
  type MeetingFile,
  type MeetingFileKind,
  MeetingFileStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MeetingFileDto } from './dto/meeting-file.dto.js';
import type { Transcript } from './transcripts/transcript.js';

type NewMeetingFile = {
  meetingId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: MeetingFileKind;
};

// The stored record, with its meeting, its storage key and the transcription
// provider's job id, which the API keeps to itself.
export type StoredMeetingFile = MeetingFileDto & {
  meetingId: string;
  storageKey: string;
  transcriptionId: string | null;
};

// Statuses a file is processed from: QUEUED, and TRANSCRIBING for recordings.
const IN_PROGRESS = [MeetingFileStatus.QUEUED, MeetingFileStatus.TRANSCRIBING];

const toDto = (file: MeetingFile): StoredMeetingFile => ({
  id: file.id,
  name: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  kind: file.kind,
  status: file.status,
  // Written only by markReady, so the shape is known.
  transcript: file.transcript as Transcript | null,
  error: file.error,
  createdAt: file.createdAt.toISOString(),
  meetingId: file.meetingId,
  storageKey: file.storageKey,
  transcriptionId: file.transcriptionId,
});

export function withoutStorageKey(file: StoredMeetingFile): MeetingFileDto {
  const { id, name, mimeType, size, kind, status, transcript, error, createdAt } = file;
  return { id, name, mimeType, size, kind, status, transcript, error, createdAt };
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

  // deleteMany, so a row a concurrent request already removed is not an error.
  async delete(id: string): Promise<void> {
    await this.prisma.meetingFile.deleteMany({ where: { id } });
  }

  // QUEUED → TRANSCRIBING, keeping the provider's job id. False when the
  // file is no longer QUEUED (deleted, or handled by another attempt).
  async markTranscribing(id: string, transcriptionId: string): Promise<boolean> {
    const { count } = await this.prisma.meetingFile.updateMany({
      where: { id, status: MeetingFileStatus.QUEUED },
      data: { status: MeetingFileStatus.TRANSCRIBING, transcriptionId },
    });
    return count > 0;
  }

  // QUEUED or TRANSCRIBING → READY with the transcript. False when the file
  // is no longer in progress (deleted, or handled by another attempt).
  async markReady(id: string, transcript: Transcript): Promise<boolean> {
    const { count } = await this.prisma.meetingFile.updateMany({
      where: { id, status: { in: IN_PROGRESS } },
      data: { status: MeetingFileStatus.READY, transcript, error: null, transcriptionId: null },
    });
    return count > 0;
  }

  // QUEUED or TRANSCRIBING → FAILED with a message for the owner.
  async markFailed(id: string, error: string): Promise<boolean> {
    const { count } = await this.prisma.meetingFile.updateMany({
      where: { id, status: { in: IN_PROGRESS } },
      data: { status: MeetingFileStatus.FAILED, error, transcriptionId: null },
    });
    return count > 0;
  }

  // FAILED → QUEUED, clearing the error. False when it was not FAILED.
  async requeue(id: string): Promise<boolean> {
    const { count } = await this.prisma.meetingFile.updateMany({
      where: { id, status: MeetingFileStatus.FAILED },
      data: { status: MeetingFileStatus.QUEUED, error: null },
    });
    return count > 0;
  }

  // Every file of the meeting, pending uploads included, oldest first.
  async findAllByMeeting(meetingId: string): Promise<StoredMeetingFile[]> {
    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return files.map(toDto);
  }

  // Uploads that were registered before `before` and never completed.
  async findAbandoned(before: Date, limit: number): Promise<StoredMeetingFile[]> {
    const files = await this.prisma.meetingFile.findMany({
      where: { status: MeetingFileStatus.PENDING_UPLOAD, createdAt: { lt: before } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return files.map(toDto);
  }

  // Removes a row only while it is still pending, so a file that was
  // completed meanwhile is kept. False when it was not.
  async deletePending(id: string): Promise<boolean> {
    const { count } = await this.prisma.meetingFile.deleteMany({
      where: { id, status: MeetingFileStatus.PENDING_UPLOAD },
    });
    return count > 0;
  }

  async findOne(id: string): Promise<StoredMeetingFile | null> {
    const file = await this.prisma.meetingFile.findUnique({ where: { id } });
    return file && toDto(file);
  }
}
