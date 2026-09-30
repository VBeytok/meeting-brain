import { Plus } from '@gravity-ui/icons';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppHeader } from '@/components/app-header';
import { ButtonLink } from '@/components/button-link';
import { getSession } from '@/lib/session';
import { Dashboard, DashboardSkeleton } from './dashboard';

export const metadata: Metadata = {
  title: 'Home · Meeting Brain',
};

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  // Set by the create-meeting action, so the dashboard can confirm the new meeting.
  const { created } = await searchParams;

  return (
    <>
      <AppHeader session={session} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your meetings</h1>
            <p className="mt-2 text-muted">A quick look at everything you have on record.</p>
          </div>
          <ButtonLink className="h-11" href="/meetings/new">
            <Plus aria-hidden />
            New meeting
          </ButtonLink>
        </div>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard
            createdId={typeof created === 'string' ? created : undefined}
            session={session}
          />
        </Suspense>
      </main>
    </>
  );
}
