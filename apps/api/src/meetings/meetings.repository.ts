import { Injectable } from '@nestjs/common';
import type { Meeting } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MeetingDto } from './dto/meeting.dto.js';

type NewMeeting = { ownerId: string; title: string; date: Date; participants: string[] };

const toDto = ({ id, title, date, participants }: Meeting): MeetingDto => ({
  id,
  title,
  date: date.toISOString(),
  participants,
});

// Every read is scoped to an owner, so a user can never reach another user's meetings.
@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(meeting: NewMeeting): Promise<MeetingDto> {
    return toDto(await this.prisma.meeting.create({ data: meeting }));
  }

  async findAllByOwner(ownerId: string): Promise<MeetingDto[]> {
    const meetings = await this.prisma.meeting.findMany({ where: { ownerId } });
    return meetings.map(toDto);
  }

  async findOneByOwner(id: string, ownerId: string): Promise<MeetingDto | null> {
    const meeting = await this.prisma.meeting.findFirst({ where: { id, ownerId } });
    return meeting && toDto(meeting);
  }
}
