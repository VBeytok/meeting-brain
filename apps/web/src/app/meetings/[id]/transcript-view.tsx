'use client';

import { useEffect, useRef } from 'react';
import type { Transcript, TranscriptSegment } from '@/lib/meetings';

// 75.5 → "1:15", 3725 → "1:02:05". Whole seconds: enough to find a moment.
function clock(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// The segment being spoken at `time`: the last one started, until it ends
// (or, without an end, until the next one starts). -1 between segments.
function activeIndex(segments: TranscriptSegment[], time: number): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    const { start, end } = segments[i];
    if (start !== undefined && start <= time) {
      const until = end ?? segments[i + 1]?.start ?? Infinity;
      return time < until ? i : -1;
    }
  }
  return -1;
}

// A parsed transcript in a fixed-height, scrollable box: one line per
// segment, with its start time and speaker when the file had them. The box
// is focusable so keyboard users can scroll it.
//
// Next to a player (`onSeek` and `currentTime` given), each timed line is a
// button that seeks to it, and the line being spoken is highlighted. The box
// follows the highlight while it is in view; once the reader scrolls away,
// it stays where they left it.
export function TranscriptView({
  transcript,
  name,
  currentTime,
  onSeek,
}: {
  transcript: Transcript;
  name: string;
  currentTime?: number;
  onSeek?: (seconds: number) => void;
}) {
  const boxRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  const previous = useRef(-1);
  const timed = transcript.segments.some((segment) => segment.start !== undefined);
  const active = currentTime === undefined ? -1 : activeIndex(transcript.segments, currentTime);

  useEffect(() => {
    const box = boxRef.current;
    const line = lineRefs.current[active];
    const before = lineRefs.current[previous.current];
    previous.current = active;
    if (!box || !line) return;
    // Follow only a reader who was following: the last highlight was in view.
    if (before && !isInView(box, before)) return;
    if (isInView(box, line)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({
      top: line.offsetTop - box.clientHeight / 3,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [active]);

  return (
    <section
      ref={boxRef}
      aria-label={`Transcript of ${name}`}
      className="relative max-h-80 overflow-y-auto rounded-xl border border-separator bg-surface px-2 py-2 outline-none focus-visible:focus-ring"
      lang={transcript.language ?? undefined}
      tabIndex={0}
    >
      {timed ? (
        <ol className="flex flex-col gap-1">
          {transcript.segments.map((segment, i) => {
            const isActive = i === active;
            const content = (
              <>
                <span className="pt-px font-mono text-xs text-muted tabular-nums">
                  {segment.start === undefined ? '' : clock(segment.start)}
                </span>
                <span className="break-words">
                  {segment.speaker ? (
                    <span className="font-semibold">{segment.speaker}: </span>
                  ) : null}
                  {segment.text}
                </span>
              </>
            );
            const row = `grid w-full grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 rounded-lg px-2 py-1.5 text-left text-sm ${
              isActive ? 'bg-accent-soft text-accent-soft-foreground' : ''
            }`;
            return (
              // Segments have no id; their order never changes.
              <li
                key={i}
                ref={(element) => {
                  lineRefs.current[i] = element;
                }}
                aria-current={isActive ? 'true' : undefined}
              >
                {onSeek && segment.start !== undefined ? (
                  <button
                    aria-label={`Play from ${clock(segment.start)}: ${segment.speaker ? `${segment.speaker}, ` : ''}${segment.text}`}
                    className={`${row} cursor-pointer transition-colors outline-none hover:bg-default focus-visible:focus-ring ${
                      isActive ? 'hover:bg-accent-soft-hover' : ''
                    }`}
                    type="button"
                    onClick={() => onSeek(segment.start!)}
                  >
                    {content}
                  </button>
                ) : (
                  <p className={row}>{content}</p>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        transcript.segments.map((segment, i) => (
          <p key={i} className="px-2 py-1 text-sm break-words whitespace-pre-wrap">
            {segment.text}
          </p>
        ))
      )}
    </section>
  );
}

function isInView(box: HTMLElement, line: HTMLElement): boolean {
  const top = line.offsetTop;
  return top >= box.scrollTop && top + line.offsetHeight <= box.scrollTop + box.clientHeight;
}
