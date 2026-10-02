import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AnalysisRejectedError, MeetingAnalyzer } from '../../../analysis/analyzer.js';
import { GetAnalysisInputQuery } from '../../../meeting-files/queries/get-analysis-input/get-analysis-input.query.js';
import { MeetingAnalysisRepository } from '../../meeting-analysis.repository.js';
import { AnalyzeMeetingCommand } from './analyze-meeting.command.js';

const UNEXPECTED = 'Something went wrong on our side. Try again.';

// Builds the meeting's analysis from its READY files, in upload order. Waits
// (does nothing) while a file is still uploading or processing: that file's
// outcome sends a new job. With no READY file left, removes the analysis.
@CommandHandler(AnalyzeMeetingCommand)
export class AnalyzeMeetingHandler implements ICommandHandler<AnalyzeMeetingCommand> {
  private readonly logger = new Logger(AnalyzeMeetingHandler.name);

  constructor(
    private readonly analyses: MeetingAnalysisRepository,
    private readonly analyzer: MeetingAnalyzer,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({ meetingId, isLastAttempt }: AnalyzeMeetingCommand): Promise<void> {
    const input = await this.queryBus.execute(new GetAnalysisInputQuery(meetingId));
    if (input.inProgress) return;
    if (input.ready.length === 0) {
      await this.analyses.delete(meetingId);
      return;
    }

    await this.analyses.markRunning(meetingId);
    try {
      const analysis = await this.analyzer.analyze(
        input.ready.map(({ name, transcript }) => ({ name, transcript })),
      );
      await this.analyses.markReady(meetingId, analysis, input.failedIds);
    } catch (error) {
      if (error instanceof AnalysisRejectedError) {
        await this.analyses.markFailed(meetingId, error.message);
        return;
      }
      this.logger.error(`Analyzing meeting ${meetingId} failed`, error);
      if (isLastAttempt) {
        await this.analyses.markFailed(meetingId, UNEXPECTED);
        return;
      }
      throw error;
    }
  }
}
