import { cookies } from 'next/headers';
import { cache } from 'react';

export const SESSION_COOKIE = 'session';

export interface Session {
  accessToken: string;
  email: string;
}

// Stores the API access token in an httpOnly cookie, so client JavaScript
// never sees it. Call from a Server Action or Route Handler only.
export async function setSession(accessToken: string): Promise<void> {
  const cookieStore = await cookies();
  const exp = tokenPayload(accessToken)?.exp;
  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // The cookie expires with the token, so the browser drops it once the API
    // would reject it.
    expires: typeof exp === 'number' ? new Date(exp * 1000) : undefined,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Reads the session cookie, once per request. The token's signature is not
// checked here: the API does that on every call, so treat the result as a
// hint and let a 401 from the API send the user back to /login.
export const getSession = cache(async (): Promise<Session | null> => {
  const accessToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!accessToken) return null;
  const email = tokenPayload(accessToken)?.email;
  return typeof email === 'string' ? { accessToken, email } : null;
});

function tokenPayload(token: string): { exp?: unknown; email?: unknown } | null {
  const [, payload = ''] = token.split('.');
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      exp?: unknown;
      email?: unknown;
    };
  } catch {
    return null;
  }
}
