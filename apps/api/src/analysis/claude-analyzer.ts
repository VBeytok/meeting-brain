import Anthropic from '@anthropic-ai/sdk';
import {
  AnalysisRejectedError,
  type Analysis,
  type AnalysisSource,
  MeetingAnalyzer,
} from './analyzer.js';
import { transcriptText } from './transcript-text.js';

export const ANALYSIS_MODEL = 'claude-sonnet-5-5';

const SYSTEM = `You analyze meeting transcripts. The transcript may come in several parts (a meeting recorded in pieces, or a recording plus notes); treat them as one meeting, in order.

Write, in the language most of the meeting was held in:
- summary: what the meeting covered and concluded, in a few short paragraphs. No preamble.
- actionItems: every task someone agreed to do. owner and dueDate only when the transcript says them (a name or speaker label; a date or phrase such as "Friday" as said). Leave them out otherwise; never guess.
- decisions: what was agreed or settled, one sentence each.
- language: the BCP 47 tag of that language, e.g. "en" or "uk".

Use only what the transcript says. Empty lists are fine.`;

const SCHEMA = {
  type: 'object',
  properties: {
    language: { type: 'string' },
    summary: { type: 'string' },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          owner: { type: 'string' },
          dueDate: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
    decisions: { type: 'array', items: { type: 'string' } },
  },
  required: ['language', 'summary', 'actionItems', 'decisions'],
  additionalProperties: false,
};

// Claude through the Anthropic SDK, with structured output: the reply is JSON
// matching SCHEMA. The SDK retries rate limits and server errors itself.
export class ClaudeAnalyzer extends MeetingAnalyzer {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async analyze(sources: AnalysisSource[]): Promise<Analysis> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: ANALYSIS_MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: 'user', content: transcriptText(sources) }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      });
    } catch (error) {
      // A request the API will never accept, e.g. a transcript too long.
      if (
        error instanceof Anthropic.BadRequestError ||
        error instanceof Anthropic.UnprocessableEntityError
      ) {
        throw new AnalysisRejectedError(error.message);
      }
      throw error;
    }
    if (message.stop_reason === 'refusal') {
      throw new AnalysisRejectedError('The model declined to analyze this meeting.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new AnalysisRejectedError('The analysis was too long to finish.');
    }
    const text = message.content.find((block) => block.type === 'text')?.text;
    if (!text) {
      throw new Error('The model returned no analysis');
    }
    return withoutBlankFields(JSON.parse(text) as Analysis);
  }
}

// The schema cannot forbid empty strings; drop them so the UI shows nothing
// rather than an empty owner.
function withoutBlankFields(analysis: Analysis): Analysis {
  return {
    ...analysis,
    actionItems: analysis.actionItems.map(({ text, owner, dueDate }) => ({
      text,
      ...(owner?.trim() ? { owner: owner.trim() } : {}),
      ...(dueDate?.trim() ? { dueDate: dueDate.trim() } : {}),
    })),
  };
}
