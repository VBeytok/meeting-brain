'use server';

import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import type { MeetingFile } from '@/lib/meetings';
import { getSession } from '@/lib/session';

export type CreateUploadResult =
  | {
      ok: true;
      file: MeetingFile;
      // The browser PUTs the bytes here, straight to storage, with these headers.
      uploadUrl: string;
      uploadHeaders: Record<string, string>;
    }
  | { ok: false; error: string };

export type CompleteUploadResult = { ok: true; file: MeetingFile } | { ok: false; error: string };

export type DeleteFileResult = { ok: true } | { ok: false; error: string };

export type RetryFileResult = { ok: true } | { ok: false; error: string };

export type RetryAnalysisResult = RetryFileResult;

// Registers a file with the API and returns where to upload it. The browser
// never calls the API itself; it only talks to storage, with a presigned URL.
export async function createUpload(
  meetingId: string,
  file: { name: string; mimeType: string; size: number },
): Promise<CreateUploadResult> {
  const response = await callApi(`/meetings/${encodeURIComponent(meetingId)}/files`, {
    body: { name: file.name, mimeType: file.mimeType, size: file.size },
  });
  if ('error' in response) return { ok: false, error: response.error };

  const body = await response.json().catch(() => null);
  if (!body?.file || typeof body.uploadUrl !== 'string') {
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, ...(body as Omit<Extract<CreateUploadResult, { ok: true }>, 'ok'>) };
}

// Tells the API the bytes are in storage. It checks them and queues the file.
export async function completeUpload(
  meetingId: string,
  fileId: string,
): Promise<CompleteUploadResult> {
  const response = await callApi(
    `/meetings/${encodeURIComponent(meetingId)}/files/${encodeURIComponent(fileId)}/complete`,
  );
  if ('error' in response) return { ok: false, error: response.error };

  const file = (await response.json().catch(() => null)) as MeetingFile | null;
  return file?.id ? { ok: true, file } : { ok: false, error: GENERIC_ERROR };
}

// Removes a file and its stored object, confirmed or still uploading (that is
// how Cancel frees the file's slot). A file that is already gone counts as
// deleted.
export async function deleteFile(meetingId: string, fileId: string): Promise<DeleteFileResult> {
  const response = await callApi(
    `/meetings/${encodeURIComponent(meetingId)}/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE', notFoundIsOk: true },
  );
  return 'error' in response ? { ok: false, error: response.error } : { ok: true };
}

// Sends a file whose processing failed back to the queue.
export async function retryFile(meetingId: string, fileId: string): Promise<RetryFileResult> {
  const response = await callApi(
    `/meetings/${encodeURIComponent(meetingId)}/files/${encodeURIComponent(fileId)}/retry`,
  );
  return 'error' in response ? { ok: false, error: response.error } : { ok: true };
}

// Rebuilds a summary that failed.
export async function retryAnalysis(meetingId: string): Promise<RetryAnalysisResult> {
  const response = await callApi(`/meetings/${encodeURIComponent(meetingId)}/analysis/retry`);
  return 'error' in response ? { ok: false, error: response.error } : { ok: true };
}

const GENERIC_ERROR = 'Something went wrong on our side. Try again.';

// Calls the API as the signed-in user (POST unless told otherwise). A missing
// or rejected session redirects to /login; other failures become a message
// for the file's row.
async function callApi(
  path: string,
  {
    method = 'POST',
    body,
    notFoundIsOk = false,
  }: { method?: 'POST' | 'DELETE'; body?: object; notFoundIsOk?: boolean } = {},
): Promise<Response | { error: string }> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { error: 'We could not reach the server. Try again in a moment.' };
  }

  if (response.status === 401) {
    redirect('/login');
  }
  if (response.ok || (notFoundIsOk && response.status === 404)) {
    return response;
  }
  if (response.status === 404) {
    return { error: 'This meeting is no longer available. Reload the page.' };
  }
  if (response.status === 400 || response.status === 409) {
    // The API explains these: unsupported type, the 10-file limit, an upload
    // that did not arrive whole.
    const message = (await response.json().catch(() => null))?.message;
    return { error: apiMessage(message) };
  }
  return { error: GENERIC_ERROR };
}

function apiMessage(message: unknown): string {
  const text = Array.isArray(message) ? message.join('. ') : message;
  if (typeof text !== 'string' || text === '') return GENERIC_ERROR;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
