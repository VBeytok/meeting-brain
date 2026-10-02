import { Alert, Chip, Spinner } from '@heroui/react';
import type { ReactNode } from 'react';
import { dateTimeFormat } from '@/lib/dates';
import type { ListedMeetingFile, MeetingAnalysis } from '@/lib/meetings';
import { RetryAnalysisButton } from './retry-analysis-button';

const languageNames = new Intl.DisplayNames('en', { type: 'language' });

function languageName(tag: string): string {
  try {
    return languageNames.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

// The meeting's summary, action items and decisions, in every state: none
// yet, waiting for files, being written, ready (possibly without some failed
// files), failed with a retry. A rebuild keeps the last summary on screen.
export function AnalysisPanel({
  meetingId,
  analysis,
  files,
}: {
  meetingId: string;
  analysis: MeetingAnalysis | null;
  files: ListedMeetingFile[];
}) {
  if (!analysis) {
    return (
      <Placeholder>
        Nothing to summarize yet. Once a recording or transcript of this meeting is processed, the
        summary will appear here.
      </Placeholder>
    );
  }

  const filesInProgress = files.some(
    (file) => file.status === 'QUEUED' || file.status === 'TRANSCRIBING',
  );
  const isBuilding = analysis.status === 'PENDING' || analysis.status === 'RUNNING';
  const waitingForFiles = analysis.status === 'PENDING' && filesInProgress;
  const skipped = analysis.skippedFileIds
    .map((id) => files.find((file) => file.id === id)?.name)
    .filter((name): name is string => name !== undefined);

  return (
    <div className="flex flex-col gap-4">
      {analysis.status === 'FAILED' ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>The summary could not be written.</Alert.Title>
            <Alert.Description>{analysis.error ?? 'Something went wrong.'}</Alert.Description>
            <div className="mt-2">
              <RetryAnalysisButton meetingId={meetingId} />
            </div>
          </Alert.Content>
        </Alert>
      ) : null}

      {isBuilding && analysis.summary === null ? (
        <div
          className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-separator px-4 py-6 text-sm text-muted"
          role="status"
        >
          <Spinner aria-hidden color="current" size="sm" />
          {waitingForFiles
            ? 'The summary is written once every file is processed.'
            : 'Writing the summary…'}
        </div>
      ) : null}

      {analysis.summary !== null ? (
        <article className="flex flex-col gap-5" lang={analysis.language ?? undefined}>
          {isBuilding ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted" role="status">
              <Chip size="sm" variant="soft">
                <Spinner aria-hidden color="current" size="sm" />
                Updating
              </Chip>
              {waitingForFiles
                ? 'The files changed; this is rewritten once every file is processed.'
                : 'The files changed; rewriting it now.'}
            </div>
          ) : null}

          {skipped.length > 0 && !isBuilding ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  Written without {plural(skipped.length, 'file')} that failed
                </Alert.Title>
                <Alert.Description className="break-words">
                  {skipped.join(', ')}. Retry {skipped.length === 1 ? 'it' : 'them'} in the list
                  below to include {skipped.length === 1 ? 'it' : 'them'}.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <p className="text-sm leading-relaxed break-words whitespace-pre-line">
            {analysis.summary}
          </p>

          <Group title="Action items">
            {analysis.actionItems.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {analysis.actionItems.map((item, i) => (
                  // Items have no id; a rebuild replaces the whole list.
                  <li key={i} className="flex gap-3 text-sm">
                    {/* A dot, not a box: these are not checkable. */}
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p className="break-words">{item.text}</p>
                      {item.owner || item.dueDate ? (
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                          {item.owner ? <span>Owner: {item.owner}</span> : null}
                          {item.dueDate ? <span>Due: {item.dueDate}</span> : null}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No action items were mentioned.</p>
            )}
          </Group>

          <Group title="Decisions">
            {analysis.decisions.length > 0 ? (
              <ul className="flex list-disc flex-col gap-2 pl-5 text-sm marker:text-muted">
                {analysis.decisions.map((decision, i) => (
                  <li key={i} className="break-words">
                    {decision}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No decisions were recorded.</p>
            )}
          </Group>

          {analysis.generatedAt ? (
            <p className="text-xs text-muted" lang="en">
              Written{' '}
              <time dateTime={analysis.generatedAt}>
                {dateTimeFormat.format(new Date(analysis.generatedAt))}
              </time>
              {analysis.language ? ` · in ${languageName(analysis.language)}` : null}
            </p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold" lang="en">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-separator px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
