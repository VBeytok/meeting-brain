import { ArrowLeft } from '@gravity-ui/icons';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppHeader } from '@/components/app-header';
import { TextLink } from '@/components/text-link';
import { getMeeting } from '@/lib/meetings';
import { getSession } from '@/lib/session';
import { MeetingDetails, MeetingDetailsSkeleton } from './meeting-details';

export async function generateMetadata({ params }: PageProps<'/meetings/[id]'>): Promise<Metadata> {
  const session = await getSession();
  if (!session) return { title: 'Meeting Brain' };
  const result = await getMeeting(session, (await params).id);
  const title =
    result.status === 'found'
      ? result.meeting.title
      : result.status === 'not-found'
        ? 'Meeting not found'
        : 'Meeting';
  return { title: `${title} · Meeting Brain` };
}

export default async function MeetingPage({ params }: PageProps<'/meetings/[id]'>) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const { id } = await params;

  return (
    <>
      <AppHeader session={session} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <TextLink className="inline-flex min-h-11 items-center gap-1.5 text-sm" href="/">
          <ArrowLeft aria-hidden className="size-4" />
          Back to your meetings
        </TextLink>
        {/* Keyed by id, so moving between meetings shows the skeleton again. */}
        <Suspense key={id} fallback={<MeetingDetailsSkeleton />}>
          <MeetingDetails id={id} session={session} />
        </Suspense>
      </main>
    </>
  );
}
