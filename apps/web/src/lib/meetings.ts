import { redirect } from 'next/navigation';
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
