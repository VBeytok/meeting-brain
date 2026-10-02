import type { Transcript } from '@/lib/meetings';

// 75.5 → "1:15", 3725 → "1:02:05". Whole seconds: enough to find a moment.
function clock(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// A parsed transcript in a fixed-height, scrollable box: one line per
// segment, with its start time and speaker when the file had them. The box
// is focusable so keyboard users can scroll it.
export function TranscriptView({ transcript, name }: { transcript: Transcript; name: string }) {
  const timed = transcript.segments.some((segment) => segment.start !== undefined);
  return (
    <section
      aria-label={`Transcript of ${name}`}
      className="max-h-80 overflow-y-auto rounded-xl border border-separator bg-surface px-4 py-3 outline-none focus-visible:focus-ring"
      lang={transcript.language ?? undefined}
      tabIndex={0}
    >
      {timed ? (
        <ol className="flex flex-col gap-3">
          {transcript.segments.map((segment, i) => (
            // Segments have no id; their order never changes.
            <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 text-sm">
              <span className="pt-px font-mono text-xs text-muted tabular-nums">
                {segment.start === undefined ? '' : clock(segment.start)}
              </span>
              <p className="break-words">
                {segment.speaker ? (
                  <span className="font-semibold">{segment.speaker}: </span>
                ) : null}
                {segment.text}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        transcript.segments.map((segment, i) => (
          <p key={i} className="text-sm break-words whitespace-pre-wrap">
            {segment.text}
          </p>
        ))
      )}
    </section>
  );
}
