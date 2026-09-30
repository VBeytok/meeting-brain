'use server';

import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { setSession } from '@/lib/session';

export interface LoginState {
  // Keyed by input name; HeroUI's Form shows them on the matching field.
  fieldErrors?: { email?: string; password?: string };
  formError?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { formError: 'Enter your email and password.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { formError: 'We could not reach the server. Try again in a moment.' };
  }

  // The API does not say which of the two was wrong, and neither do we.
  if (response.status === 401) {
    return { formError: 'That email and password do not match an account.' };
  }
  // LoginDto only checks that the email is an email and the password is set.
  if (response.status === 400) {
    return { fieldErrors: { email: 'Enter a valid email address.' } };
  }
  if (!response.ok) {
    return { formError: 'Something went wrong on our side. Try again.' };
  }

  const { accessToken } = (await response.json()) as { accessToken: string };
  await setSession(accessToken);
  redirect('/');
}
