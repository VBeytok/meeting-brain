import type { AnalysisSource } from './analyzer.js';

// The meeting as plain text for a language model: one block per file, one
// line per segment with its time and speaker when known.
export function transcriptText(sources: AnalysisSource[]): string {
  return sources
    .map(({ name, transcript }, i) => {
      const lines = transcript.segments.map((segment) => {
        const time = segment.start === undefined ? '' : `[${clock(segment.start)}] `;
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        return `${time}${speaker}${segment.text}`;
      });
      return `## Part ${i + 1}: ${name}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

function clock(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
