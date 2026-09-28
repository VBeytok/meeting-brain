import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Brand } from '@/components/brand';
import { getSession } from '@/lib/session';
import { logout } from './actions';
import { Dashboard, DashboardSkeleton } from './dashboard';
import { LogoutButton } from './logout-button';

export const metadata: Metadata = {
  title: 'Home · Meeting Brain',
};

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <>
      <header className="border-b border-separator">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand compact />
          <div className="flex min-w-0 items-center gap-3">
            <p className="min-w-0 truncate text-sm text-muted" title={session.email}>
              <span className="sr-only">Signed in as </span>
              {session.email}
            </p>
            <form action={logout}>
              <LogoutButton />
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your meetings</h1>
        <p className="mt-2 text-muted">A quick look at everything you have on record.</p>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard session={session} />
        </Suspense>
      </main>
    </>
  );
}
