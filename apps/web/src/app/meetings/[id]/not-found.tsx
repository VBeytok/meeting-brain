import { CircleQuestion } from '@gravity-ui/icons';
import { Card } from '@heroui/react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { ButtonLink } from '@/components/button-link';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Meeting not found · Meeting Brain',
};

// A missing id, a malformed one and another user's meeting all land here: the
// API answers 404 for each, so the page never reveals which ids exist.
export default async function MeetingNotFound() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Card className="mx-auto mt-6 max-w-md items-center py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
            <CircleQuestion aria-hidden className="size-6" />
          </span>
          <Card.Header className="items-center">
            <h1 className="text-xl font-semibold tracking-tight">Meeting not found</h1>
            <Card.Description className="max-w-xs">
              The link may be wrong, or the meeting is not in your account.
            </Card.Description>
          </Card.Header>
          <ButtonLink className="h-11" href="/" variant="secondary">
            Back to your meetings
          </ButtonLink>
        </Card>
      </main>
    </>
  );
}
