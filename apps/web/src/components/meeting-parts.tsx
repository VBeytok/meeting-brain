import { Chip } from '@heroui/react';
import { dayFormat, monthFormat } from '@/lib/dates';

// Calendar-leaf badge with the meeting's month and day. Decorative: the full
// date sits next to it as text.
export function MeetingDateBadge({ date, className = '' }: { date: string; className?: string }) {
  const value = new Date(date);
  return (
    <div
      aria-hidden
      className={`grid size-14 shrink-0 place-content-center rounded-xl bg-accent-soft text-center text-accent-soft-foreground ${className}`}
    >
      <span className="text-xs font-medium uppercase">{monthFormat.format(value)}</span>
      <span className="text-xl leading-none font-semibold tabular-nums">
        {dayFormat.format(value)}
      </span>
    </div>
  );
}

export function MeetingStatusChip({
  isUpcoming,
  className = '',
}: {
  isUpcoming: boolean;
  className?: string;
}) {
  return (
    <Chip className={className} color={isUpcoming ? 'accent' : 'default'} size="sm" variant="soft">
      {isUpcoming ? 'Upcoming' : 'Held'}
    </Chip>
  );
}

export function participantCount(count: number): string {
  return count === 0 ? 'No participants' : `${count} ${count === 1 ? 'person' : 'people'}`;
}
