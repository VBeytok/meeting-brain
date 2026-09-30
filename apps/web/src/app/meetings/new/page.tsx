import { ArrowLeft } from '@gravity-ui/icons';
import { Card } from '@heroui/react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { TextLink } from '@/components/text-link';
import { getSession } from '@/lib/session';
import { NewMeetingForm } from './new-meeting-form';

export const metadata: Metadata = {
  title: 'New meeting · Meeting Brain',
};

export default async function NewMeetingPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <>
      <AppHeader session={session} />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <TextLink className="inline-flex min-h-11 items-center gap-1.5 text-sm" href="/">
          <ArrowLeft aria-hidden className="size-4" />
          Back to your meetings
        </TextLink>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">New meeting</h1>
        <p className="mt-2 text-muted">When it happened, or will happen, and who took part.</p>
        <Card className="mt-8 p-6">
          <NewMeetingForm />
        </Card>
      </main>
    </>
  );
}
