import { redirect } from 'next/navigation';
import { cache } from 'react';
import { API_URL } from './api';
import type { Session } from './session';

// Mirrors the API's MeetingDto.
export interface Meeting {
  id: string;
  title: string;
  // ISO 8601, UTC.
  date: string;
  participants: string[];
}

// The caller's meetings, earliest first, or null when the API cannot be
// reached or fails. A rejected token redirects to /login.
export async function getMeetings(session: Session): Promise<Meeting[] | null> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/meetings`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return null;
  }

  if (response.status === 401) {
    redirect('/login');
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as Meeting[];
}

export type MeetingResult =
  { status: 'found'; meeting: Meeting } | { status: 'not-found' } | { status: 'error' };

// One of the caller's meetings. The API answers 404 for a missing id, a
// malformed id and another user's meeting alike. Cached per request, so the
// page and its metadata share one call. A rejected token redirects to /login.
export const getMeeting = cache(async (session: Session, id: string): Promise<MeetingResult> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/meetings/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return { status: 'error' };
  }

  if (response.status === 401) {
    redirect('/login');
  }
  if (response.status === 404) {
    return { status: 'not-found' };
  }
  if (!response.ok) {
    return { status: 'error' };
  }
  return { status: 'found', meeting: (await response.json()) as Meeting };
});
