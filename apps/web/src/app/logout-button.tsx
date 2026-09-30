'use client';

import { ArrowRightFromSquare } from '@gravity-ui/icons';
import { Button, Spinner } from '@heroui/react';
import { useFormStatus } from 'react-dom';

// Submit button of the logout form; shows progress while the action runs.
export function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="h-11" isPending={pending} size="sm" type="submit" variant="outline">
      {pending ? <Spinner color="current" size="sm" /> : <ArrowRightFromSquare />}
      Log out
    </Button>
  );
}
