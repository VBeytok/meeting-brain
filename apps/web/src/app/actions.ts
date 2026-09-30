'use server';

import { redirect } from 'next/navigation';
import { deleteSession } from '@/lib/session';

// The API keeps no session state, so logging out only drops the cookie.
export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
