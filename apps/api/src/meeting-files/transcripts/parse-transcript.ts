import { type Transcript, TranscriptParseError, type TranscriptSegment } from './transcript.js';

// Picks the parser by extension; the upload checks already limited it to these.
export function parseTranscript(fileName: string, text: string): Transcript {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase();
  const normalized = normalizeText(text);
  if (normalized.trim() === '') {
    throw new TranscriptParseError('The file has no text.');
  }
  switch (extension) {
    case 'vtt':
      return parseVtt(normalized);
    case 'srt':
      return parseSrt(normalized);
    case 'txt':
      return parseTxt(normalized);
    default:
      throw new TranscriptParseError('This type of file is not a transcript.');
  }
}

// Strips a byte order mark and turns CRLF / CR line ends into LF.
function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

// "01:02:03.456", "02:03.456" (hours optional) or with a comma, as SRT writes it.
const TIMESTAMP = /^(?:(\d+):)?([0-5]?\d):([0-5]?\d)[.,](\d{1,3})$/;
const TIMING = /^(\S+)\s+-->\s+(\S+)(?:\s.*)?$/;

function seconds(stamp: string): number | null {
  const match = TIMESTAMP.exec(stamp.trim());
  if (!match) return null;
  const [, hours = '0', minutes, secs, fraction] = match;
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(secs) +
    Number(fraction.padEnd(3, '0')) / 1000
  );
}

function timing(line: string): { start: number; end: number } | null {
  const match = TIMING.exec(line.trim());
  if (!match) return null;
  const start = seconds(match[1]);
  const end = seconds(match[2]);
  return start === null || end === null ? null : { start, end };
}

// Blocks are separated by one or more blank lines.
function blocks(text: string): string[][] {
  return text
    .split(/\n[ \t]*\n/)
    .map((block) => block.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0);
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&lrm;': '',
  '&rlm;': '',
};

// Drops markup (<b>, <i>, <c.x>, <00:01.000>, <font>, {\an8}) and decodes the
// entities WebVTT allows, leaving plain text.
function plainText(line: string): string {
  return line
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|lrm|rlm);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim();
}

// A payload line's speaker from <v Name> or <v.loud Name>, if any.
function voice(line: string): string | undefined {
  const match = /<v(?:\.[^\s>]+)*\s+([^>]+)>/.exec(line);
  return match ? match[1].trim() : undefined;
}

// Turns a cue's payload into segments: lines with the same speaker are joined,
// and a new <v> starts a new segment with the same timing.
function cueSegments(payload: string[], start: number, end: number): TranscriptSegment[] {
  const groups: { speaker?: string; parts: string[] }[] = [];
  for (const line of payload) {
    const speaker = voice(line);
    const last = groups.at(-1);
    if (last === undefined || (speaker !== undefined && speaker !== last.speaker)) {
      groups.push({ speaker: speaker ?? last?.speaker, parts: [] });
    }
    const text = plainText(line);
    if (text !== '') groups[groups.length - 1].parts.push(text);
  }
  return groups
    .filter((group) => group.parts.length > 0)
    .map(({ speaker, parts }) => ({
      start,
      end,
      ...(speaker === undefined ? {} : { speaker }),
      text: parts.join(' '),
    }));
}

export function parseVtt(text: string): Transcript {
  const [header, ...rest] = blocks(text);
  if (!header || !/^WEBVTT(?:[ \t].*)?$/.test(header[0])) {
    throw new TranscriptParseError('This is not a WebVTT file: it must start with "WEBVTT".');
  }
  // Header lines after WEBVTT may carry metadata such as "Language: en".
  const languageLine = header.slice(1).find((line) => /^language\s*:/i.test(line));
  const language = languageLine?.split(':')[1]?.trim() || null;

  // A cue may sit in the header block when there is no blank line after WEBVTT;
  // the timing line tells cues apart from metadata.
  const headerCue = header.findIndex((line) => line.includes('-->'));
  const cueBlocks = headerCue === -1 ? rest : [header.slice(Math.max(1, headerCue - 1)), ...rest];

  const segments: TranscriptSegment[] = [];
  for (const block of cueBlocks) {
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(block[0])) continue;
    const timingIndex = block.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1 || timingIndex > 1) continue;
    const times = timing(block[timingIndex]);
    if (!times) {
      throw new TranscriptParseError(`Unreadable cue timing: "${block[timingIndex].trim()}".`);
    }
    segments.push(...cueSegments(block.slice(timingIndex + 1), times.start, times.end));
  }
  if (segments.length === 0) {
    throw new TranscriptParseError('The file has no cues with text.');
  }
  return { language, segments };
}

export function parseSrt(text: string): Transcript {
  const segments: TranscriptSegment[] = [];
  for (const block of blocks(text)) {
    // A numeric counter line, then the timing; some tools leave the counter out.
    const timingIndex = block.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1 || timingIndex > 1) {
      throw new TranscriptParseError(`Unreadable subtitle block: "${block[0].trim()}".`);
    }
    const times = timing(block[timingIndex]);
    if (!times) {
      throw new TranscriptParseError(`Unreadable subtitle timing: "${block[timingIndex].trim()}".`);
    }
    const lines = block
      .slice(timingIndex + 1)
      .map(plainText)
      .filter(Boolean);
    if (lines.length > 0) {
      segments.push({ start: times.start, end: times.end, text: lines.join(' ') });
    }
  }
  if (segments.length === 0) {
    throw new TranscriptParseError('The file has no subtitles with text.');
  }
  return { language: null, segments };
}

// Plain text has no timing or speakers: one segment, with its line breaks.
export function parseTxt(text: string): Transcript {
  return { language: null, segments: [{ text: text.trim() }] };
}
