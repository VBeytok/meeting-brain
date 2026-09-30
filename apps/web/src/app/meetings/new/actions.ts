'use server';

import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import type { Meeting } from '@/lib/meetings';
import { getSession } from '@/lib/session';

export interface CreateMeetingState {
  // Keyed by input name; HeroUI's Form shows them on the matching field.
  fieldErrors?: { title?: string; date?: string; participants?: string };
  formError?: string;
}

// `date` arrives as an ISO 8601 instant: the form converts the picked local
// time on the client, where the user's timezone is known.
export async function createMeeting(
  _prev: CreateMeetingState,
  formData: FormData,
): Promise<CreateMeetingState> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const title = formData.get('title');
  const date = formData.get('date');
  const participants = formData.getAll('participants');
  if (
    typeof title !== 'string' ||
    typeof date !== 'string' ||
    participants.some((p) => typeof p !== 'string')
  ) {
    return { formError: 'Check the meeting details and try again.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ title: title.trim(), date, participants }),
    });
  } catch {
    return { formError: 'We could not reach the server. Try again in a moment.' };
  }

  if (response.status === 401) {
    redirect('/login');
  }
  if (response.status === 400) {
    return fromValidationError(await response.json().catch(() => null));
  }
  if (!response.ok) {
    return { formError: 'Something went wrong on our side. Try again.' };
  }

  const meeting = (await response.json().catch(() => null)) as Meeting | null;
  if (!meeting?.id) {
    return { formError: 'Something went wrong on our side. Try again.' };
  }
  redirect(`/?created=${encodeURIComponent(meeting.id)}`);
}

// Nest's ValidationPipe answers `{ message: string[] }`, each message starting
// with the property name ("title must not be blank", "each value in
// participants must ...").
function fromValidationError(body: unknown): CreateMeetingState {
  const raw = (body as { message?: unknown } | null)?.message;
  const messages = Array.isArray(raw) ? raw.map(String) : [];
  const fieldErrors: NonNullable<CreateMeetingState['fieldErrors']> = {};
  if (messages.some((m) => m.startsWith('title'))) {
    fieldErrors.title = 'Enter a title of up to 200 characters.';
  }
  if (messages.some((m) => m.startsWith('date'))) {
    fieldErrors.date = 'Pick a valid date and time.';
  }
  if (messages.some((m) => m.includes('participants'))) {
    fieldErrors.participants = 'Check the participants: up to 100 email addresses.';
  }
  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : { formError: 'Check the meeting details and try again.' };
}
