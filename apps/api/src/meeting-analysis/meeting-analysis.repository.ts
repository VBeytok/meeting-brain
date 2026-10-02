import { Injectable } from '@nestjs/common';
import { type MeetingAnalysis, MeetingAnalysisStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActionItem, Analysis } from '../analysis/analyzer.js';
import type { MeetingAnalysisDto } from './dto/meeting-analysis.dto.js';

const toDto = (row: MeetingAnalysis): MeetingAnalysisDto => ({
  status: row.status,
  summary: row.summary,
  // Written only by markReady, so the shapes are known.
  actionItems: (row.actionItems as ActionItem[] | null) ?? [],
  decisions: (row.decisions as string[] | null) ?? [],
  language: row.language,
  skippedFileIds: row.skippedFileIds,
  error: row.error,
  generatedAt: row.generatedAt?.toISOString() ?? null,
});

// Data access for meeting_analyses, one row per meeting. Takes meeting ids
// the caller has already checked (or a background job's).
@Injectable()
export class MeetingAnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByMeeting(meetingId: string): Promise<MeetingAnalysisDto | null> {
    const row = await this.prisma.meetingAnalysis.findUnique({ where: { meetingId } });
    return row && toDto(row);
  }

  // A rebuild is due. Creates the row on the first one; keeps the last
  // build's content to show meanwhile.
  async markPending(meetingId: string): Promise<void> {
    await this.prisma.meetingAnalysis.upsert({
      where: { meetingId },
      create: { meetingId },
      update: { status: MeetingAnalysisStatus.PENDING, error: null },
    });
  }

  async markRunning(meetingId: string): Promise<void> {
    await this.prisma.meetingAnalysis.upsert({
      where: { meetingId },
      create: { meetingId, status: MeetingAnalysisStatus.RUNNING },
      update: { status: MeetingAnalysisStatus.RUNNING, error: null },
    });
  }

  // Stores a finished build. READY only if nothing changed while it ran:
  // when files changed meanwhile the row is PENDING again, and stays so for
  // the job that will rebuild it.
  async markReady(meetingId: string, analysis: Analysis, skippedFileIds: string[]): Promise<void> {
    const content = {
      summary: analysis.summary,
      actionItems: analysis.actionItems,
      decisions: analysis.decisions,
      language: analysis.language,
      skippedFileIds,
      error: null,
      generatedAt: new Date(),
    };
    const { count } = await this.prisma.meetingAnalysis.updateMany({
      where: { meetingId, status: MeetingAnalysisStatus.RUNNING },
      data: { ...content, status: MeetingAnalysisStatus.READY },
    });
    if (count === 0) {
      await this.prisma.meetingAnalysis.updateMany({ where: { meetingId }, data: content });
    }
  }

  // RUNNING → FAILED. A row that went PENDING meanwhile is left for the rebuild.
  async markFailed(meetingId: string, error: string): Promise<void> {
    await this.prisma.meetingAnalysis.updateMany({
      where: { meetingId, status: MeetingAnalysisStatus.RUNNING },
      data: { status: MeetingAnalysisStatus.FAILED, error },
    });
  }

  // FAILED → PENDING. False when it was not FAILED.
  async requeue(meetingId: string): Promise<boolean> {
    const { count } = await this.prisma.meetingAnalysis.updateMany({
      where: { meetingId, status: MeetingAnalysisStatus.FAILED },
      data: { status: MeetingAnalysisStatus.PENDING, error: null },
    });
    return count > 0;
  }

  async delete(meetingId: string): Promise<void> {
    await this.prisma.meetingAnalysis.deleteMany({ where: { meetingId } });
  }
}
