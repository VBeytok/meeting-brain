'use server';

import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { setSession } from '@/lib/session';

export interface RegisterState {
  // Keyed by input name; HeroUI's Form shows them on the matching field.
  fieldErrors?: { email?: string; password?: string };
  formError?: string;
}

export async function register(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { formError: 'Enter your email and a password.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { formError: 'We could not reach the server. Try again in a moment.' };
  }

  if (response.status === 409) {
    return { fieldErrors: { email: 'An account with this email already exists.' } };
  }
  if (response.status === 400) {
    return fromValidationError(await response.json().catch(() => null));
  }
  if (!response.ok) {
    return { formError: 'Something went wrong on our side. Try again.' };
  }

  const { accessToken } = (await response.json()) as { accessToken: string };
  await setSession(accessToken);
  redirect('/');
}

// Nest's ValidationPipe answers `{ message: string[] }`, each message starting
// with the property name ("email must be an email").
function fromValidationError(body: unknown): RegisterState {
  const raw = (body as { message?: unknown } | null)?.message;
  const messages = Array.isArray(raw) ? raw.map(String) : [];
  const fieldErrors: NonNullable<RegisterState['fieldErrors']> = {};
  if (messages.some((m) => m.startsWith('email'))) {
    fieldErrors.email = 'Enter a valid email address.';
  }
  if (messages.some((m) => m.startsWith('password'))) {
    fieldErrors.password = 'Use 8 to 128 characters.';
  }
  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : { formError: 'Check your details and try again.' };
}
