import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RetryMeetingAnalysisCommand } from './commands/retry-meeting-analysis/retry-meeting-analysis.command.js';
import type { MeetingAnalysisDto } from './dto/meeting-analysis.dto.js';

// The analysis itself is read with GET /meetings/:id.
@Controller('meetings/:meetingId/analysis')
@UseGuards(JwtAuthGuard)
export class MeetingAnalysisController {
  constructor(private readonly commandBus: CommandBus) {}

  // Rebuilds an analysis that failed (409 otherwise).
  @Post('retry')
  @HttpCode(200)
  retry(
    @CurrentUser() user: AuthUser,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingAnalysisDto> {
    return this.commandBus.execute(new RetryMeetingAnalysisCommand(meetingId, user.id));
  }
}
