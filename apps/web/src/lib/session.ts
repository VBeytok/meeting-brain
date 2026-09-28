import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'session';

// Stores the API access token in an httpOnly cookie, so client JavaScript
// never sees it. Call from a Server Action or Route Handler only.
export async function setSession(accessToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: tokenExpiry(accessToken),
  });
}

// The cookie expires with the token, so the browser drops it once the API
// would reject it. The signature is not checked here: the API does that.
function tokenExpiry(token: string): Date | undefined {
  const [, payload = ''] = token.split('.');
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: unknown };
    return typeof exp === 'number' ? new Date(exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}
