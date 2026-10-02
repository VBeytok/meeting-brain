'use client';

import { ArrowRotateRight } from '@gravity-ui/icons';
import { Button, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

// Re-renders the current route on the server, so a page whose data failed to
// load tries again without a full reload.
export function RetryButton({ label = 'Try again' }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      className="h-11"
      isPending={isPending}
      size="sm"
      variant="secondary"
      onPress={() => startTransition(() => router.refresh())}
    >
      {isPending ? <Spinner color="current" size="sm" /> : <ArrowRotateRight aria-hidden />}
      {label}
    </Button>
  );
}
