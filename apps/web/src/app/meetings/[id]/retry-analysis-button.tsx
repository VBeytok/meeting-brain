'use client';

import { ArrowRotateRight } from '@gravity-ui/icons';
import { Button, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { retryAnalysis } from './actions';

// Rebuilds a failed summary, then refreshes the page to show it generating.
export function RetryAnalysisButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [isPending, startRetry] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        className="h-11"
        isPending={isPending}
        size="sm"
        variant="secondary"
        onPress={() =>
          startRetry(async () => {
            const result = await retryAnalysis(meetingId);
            if (result.ok) {
              setError(null);
              router.refresh();
            } else {
              setError(result.error);
            }
          })
        }
      >
        {isPending ? <Spinner color="current" size="sm" /> : <ArrowRotateRight aria-hidden />}
        Retry
      </Button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
