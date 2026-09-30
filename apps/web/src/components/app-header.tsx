import { logout } from '@/app/actions';
import type { Session } from '@/lib/session';
import { Brand } from './brand';
import { LogoutButton } from './logout-button';

// Top bar of the signed-in pages: the brand, who is signed in and Log out.
export function AppHeader({ session }: { session: Session }) {
  return (
    <header className="border-b border-separator">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand compact />
        <div className="flex min-w-0 items-center gap-3">
          <p className="min-w-0 truncate text-sm text-muted" title={session.email}>
            <span className="sr-only">Signed in as </span>
            {session.email}
          </p>
          <form action={logout}>
            <LogoutButton />
          </form>
        </div>
      </div>
    </header>
  );
}
