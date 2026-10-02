import { FileText, ListCheck, Persons } from '@gravity-ui/icons';
import { Alert, Card, Skeleton } from '@heroui/react';
import { notFound } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { MeetingDateBadge, MeetingStatusChip, participantCount } from '@/components/meeting-parts';
import { RetryButton } from '@/components/retry-button';
import { dateTimeFormat, isUpcoming } from '@/lib/dates';
import { getMeeting } from '@/lib/meetings';
import { FilesPanel } from './files-panel';
import type { Session } from '@/lib/session';

export async function MeetingDetails({ session, id }: { session: Session; id: string }) {
  const result = await getMeeting(session, id);
  if (result.status === 'not-found') {
    notFound();
  }
  if (result.status === 'error') {
    return (
      <Alert className="mt-6" role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>We could not load this meeting.</Alert.Title>
          <Alert.Description>Check your connection and try again.</Alert.Description>
          <div className="mt-3">
            <RetryButton />
          </div>
        </Alert.Content>
      </Alert>
    );
  }

  const { meeting } = result;
  const upcoming = isUpcoming(meeting.date);

  return (
    <>
      <header className="mt-6 flex items-start gap-4">
        <MeetingDateBadge date={meeting.date} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight break-words">{meeting.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted">
            <time dateTime={meeting.date}>{dateTimeFormat.format(new Date(meeting.date))}</time>
            <MeetingStatusChip upcoming={upcoming} />
          </p>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Section
            description="A summary, action items and decisions, written from this meeting's recordings and transcripts."
            icon={ListCheck}
            title="Summary"
          >
            <Placeholder>
              Nothing to summarize yet. Once a recording or transcript of this meeting is processed,
              the summary will appear here.
            </Placeholder>
          </Section>
          <Section
            description="Recordings and transcripts of this meeting."
            icon={FileText}
            title="Files"
          >
            <FilesPanel files={meeting.files ?? []} meetingId={meeting.id} />
          </Section>
        </div>

        <Section
          description={participantCount(meeting.participants.length)}
          icon={Persons}
          title="Participants"
        >
          {meeting.participants.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {/* The API does not de-duplicate participants, so the index keeps keys unique. */}
              {meeting.participants.map((email, i) => (
                <li key={`${i}-${email}`} className="truncate text-sm" title={email}>
                  {email}
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder>No one was recorded for this meeting.</Placeholder>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  const headingId = `section-${title.toLowerCase()}`;
  return (
    <Card aria-labelledby={headingId} className="gap-4" role="region">
      <Card.Header className="flex-row items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold" id={headingId}>
            {title}
          </h2>
          <Card.Description>{description}</Card.Description>
        </div>
      </Card.Header>
      {children}
    </Card>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-separator px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function MeetingDetailsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the meeting" role="status">
      <div className="mt-6 flex items-start gap-4">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-2/3 rounded" />
          <Skeleton className="h-4 w-56 rounded" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    </div>
  );
}
