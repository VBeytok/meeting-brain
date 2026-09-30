import { Calendar, CircleCheck, Clock, Persons, Plus } from '@gravity-ui/icons';
import { Alert, Card, Chip, Skeleton } from '@heroui/react';
import type { ComponentType, SVGProps } from 'react';
import { ButtonLink } from '@/components/button-link';
import { getMeetings, type Meeting } from '@/lib/meetings';
import type { Session } from '@/lib/session';

const LATEST_COUNT = 3;

const dayFormat = new Intl.DateTimeFormat('en', { day: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// `createdId` names a meeting that was just created; the dashboard confirms it.
export async function Dashboard({ session, createdId }: { session: Session; createdId?: string }) {
  const meetings = await getMeetings(session);

  if (meetings === null) {
    return (
      <Alert className="mt-8" role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>We could not load your meetings.</Alert.Title>
          <Alert.Description>Refresh the page to try again.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const { stats, latest } = summarize(meetings);
  const created = createdId ? meetings.find((m) => m.id === createdId) : undefined;

  return (
    <>
      {created ? <CreatedAlert meeting={created} /> : null}

      <section aria-labelledby="kpi-heading" className="mt-8">
        <h2 id="kpi-heading" className="sr-only">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Calendar} label="Meetings" value={stats.total} />
          <Kpi icon={Clock} label="Upcoming" value={stats.upcoming} />
          <Kpi icon={CircleCheck} label="Held" value={stats.held} />
          <Kpi icon={Persons} label="People met" value={stats.people} />
        </dl>
      </section>

      <section aria-labelledby="latest-heading" className="mt-10">
        <h2 id="latest-heading" className="text-xl font-semibold tracking-tight">
          Latest meetings
        </h2>
        <p className="mt-1 text-sm text-muted">The {LATEST_COUNT} most recent, by meeting date.</p>
        {latest.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {latest.map(({ meeting, isUpcoming }) => (
              <li key={meeting.id}>
                <MeetingRow isUpcoming={isUpcoming} meeting={meeting} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </section>
    </>
  );
}

// Reads the clock once, so the tiles and the rows agree on what is upcoming.
function summarize(meetings: Meeting[]) {
  const now = Date.now();
  const isUpcoming = (m: Meeting) => Date.parse(m.date) > now;
  const upcoming = meetings.filter(isUpcoming).length;
  const people = new Set(
    meetings.flatMap((m) => m.participants.map((p) => p.trim().toLowerCase())),
  );
  return {
    stats: {
      total: meetings.length,
      upcoming,
      held: meetings.length - upcoming,
      people: people.size,
    },
    // The API sorts by date, earliest first.
    latest: meetings
      .slice(-LATEST_COUNT)
      .reverse()
      .map((meeting) => ({ meeting, isUpcoming: isUpcoming(meeting) })),
  };
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
}) {
  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <Icon aria-hidden className="size-4 shrink-0 text-muted" />
      </div>
      <dd className="text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </Card>
  );
}

function MeetingRow({ meeting, isUpcoming }: { meeting: Meeting; isUpcoming: boolean }) {
  const date = new Date(meeting.date);
  const count = meeting.participants.length;

  return (
    <Card className="flex-row items-start gap-4 sm:items-center">
      <div
        aria-hidden
        className="grid size-14 shrink-0 place-content-center rounded-xl bg-accent-soft text-center text-accent-soft-foreground"
      >
        <span className="text-xs font-medium uppercase">{monthFormat.format(date)}</span>
        <span className="text-xl leading-none font-semibold tabular-nums">
          {dayFormat.format(date)}
        </span>
      </div>
      {/* The chip sits under the details on narrow screens, so the title keeps the width. */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <Card.Title className="line-clamp-2 break-words">{meeting.title}</Card.Title>
          <Card.Description className="mt-0.5">
            <time dateTime={meeting.date}>{dateTimeFormat.format(date)}</time>
            {' · '}
            {count === 0 ? 'No participants' : `${count} ${count === 1 ? 'person' : 'people'}`}
          </Card.Description>
          {count > 0 ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {meeting.participants.join(', ')}
            </p>
          ) : null}
        </div>
        <Chip
          className="shrink-0"
          color={isUpcoming ? 'accent' : 'default'}
          size="sm"
          variant="soft"
        >
          {isUpcoming ? 'Upcoming' : 'Held'}
        </Chip>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="mt-4 items-center py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
        <Calendar aria-hidden className="size-6" />
      </span>
      <Card.Header className="items-center">
        <Card.Title>No meetings yet</Card.Title>
        <Card.Description className="max-w-xs">
          Your meetings will show up here, with the latest {LATEST_COUNT} at the top.
        </Card.Description>
      </Card.Header>
      <ButtonLink className="h-11" href="/meetings/new" variant="secondary">
        <Plus aria-hidden />
        Add your first meeting
      </ButtonLink>
    </Card>
  );
}

// The new meeting may be older than the latest few, so the confirmation names it.
function CreatedAlert({ meeting }: { meeting: Meeting }) {
  return (
    <Alert className="mt-8" role="status" status="success">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Meeting added</Alert.Title>
        <Alert.Description>
          <span className="break-words">{meeting.title}</span>
          {' · '}
          <time dateTime={meeting.date}>{dateTimeFormat.format(new Date(meeting.date))}</time>
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your meetings" role="status">
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="gap-3">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-8 w-12 rounded" />
          </Card>
        ))}
      </div>
      <Skeleton className="mt-10 h-6 w-44 rounded" />
      <Skeleton className="mt-2 h-4 w-60 rounded" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: LATEST_COUNT }, (_, i) => (
          <Card key={i} className="flex-row items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
