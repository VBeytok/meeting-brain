import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { MeetingFileKind } from './file-types';
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

// Mirrors the API's Transcript: what a transcript file is parsed into.
export interface TranscriptSegment {
  // Seconds from the start; absent for plain text.
  start?: number;
  end?: number;
  speaker?: string;
  text: string;
}

export interface Transcript {
  language: string | null;
  segments: TranscriptSegment[];
}

// Mirrors the API's MeetingFileDto.
export interface MeetingFile {
  id: string;
  name: string;
  mimeType: string;
  // Bytes.
  size: number;
  kind: MeetingFileKind;
  // QUEUED waits for processing; READY and FAILED are where it ends.
  status: 'PENDING_UPLOAD' | 'QUEUED' | 'READY' | 'FAILED';
  // Set once a transcript file is READY.
  transcript: Transcript | null;
  // Why processing failed, when FAILED.
  error: string | null;
  // ISO 8601, UTC.
  createdAt: string;
}

// Mirrors the API's MeetingFileWithUrlsDto: a confirmed file as the meeting
// page lists it. Both URLs are presigned and expire 15 minutes after the fetch.
export interface ListedMeetingFile extends MeetingFile {
  // Streams the file with its own type, for <audio> / <video>.
  playbackUrl: string;
  // The same bytes as an attachment, saved under the original name.
  downloadUrl: string;
}

// Mirrors the API's MeetingDetailsDto: one meeting with its confirmed files.
export interface MeetingDetails extends Meeting {
  files: ListedMeetingFile[];
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
  { status: 'found'; meeting: MeetingDetails } | { status: 'not-found' } | { status: 'error' };

// Any UUID, like the API's isUUID check on meeting ids.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One of the caller's meetings. The API answers 404 for a missing id, a
// malformed id and another user's meeting alike. Cached per request, so the
// page and its metadata share one call. A rejected token redirects to /login.
export const getMeeting = cache(async (session: Session, id: string): Promise<MeetingResult> => {
  // Not just a shortcut: an id of ".." would survive encodeURIComponent and
  // turn /meetings/.. into a call to the API's root.
  if (!UUID.test(id)) {
    return { status: 'not-found' };
  }

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
  const meeting = (await response.json().catch(() => null)) as MeetingDetails | null;
  return meeting ? { status: 'found', meeting } : { status: 'error' };
});
