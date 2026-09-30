@AGENTS.md

# @meeting-brain/web

Next.js 16 App Router, React 19, Tailwind CSS 4, HeroUI v3. Port 3000.

The `@AGENTS.md` import above and the rules block in `AGENTS.md` are managed by `next dev`. Leave both in place; put project notes in this file.

- Routes live in `src/app/`. Import alias `@/*` maps to `src/*`.
- Tailwind 4 is configured in CSS (`src/app/globals.css`); there is no `tailwind.config.*`. The root `.prettierrc.json` points `tailwindStylesheet` at that file for class sorting, so update it if the stylesheet moves.
- `typecheck` runs `next typegen` before `tsc`: global route types like `LayoutProps` and `PageProps` are generated, and plain `tsc` fails without them.

## API

- Only server code calls `@meeting-brain/api`, through Server Actions and Server Components; the API has no CORS setup, so the browser never calls it directly. Base URL: `API_URL` from `src/lib/api.ts` (env `API_URL`, default `http://localhost:3001`).
- The access token lives in the httpOnly `session` cookie, written by `setSession()` in `src/lib/session.ts`; the cookie expires with the token's `exp`. `getSession()` reads it (once per request, via `React.cache`) and decodes the email without checking the signature; `deleteSession()` drops it.
- Protected pages call `getSession()` and `redirect('/login')` when it is null. That check is only a hint: the API verifies the token on every call, and `getMeetings()` in `src/lib/meetings.ts` redirects to `/login` on a `401`. There is no Proxy (`proxy.ts`).
- `/register` (`src/app/register/`) and `/login` (`src/app/login/`): each form posts to a Server Action (`actions.ts`) that calls `POST /auth/register` or `POST /auth/login`, maps API errors to field or form errors (`401` on login is one form error that does not say which field was wrong) and redirects to `/` on success. Forms submit with `onSubmit` + `startTransition(() => formAction(formData))` rather than `action={formAction}`: React resets a form after its `action` runs, which clears the fields when the API rejects them. Both pages render inside `AuthShell` (`src/components/auth-shell.tsx`).
- `/` (`src/app/page.tsx`): header with the email and a Log out form (`logout` Server Action in `src/app/actions.ts`); `Dashboard` (`dashboard.tsx`) loads `GET /meetings` inside `<Suspense>` with a skeleton fallback and shows an alert when the API fails. Dates are formatted on the server, so they use the server's timezone.
- In-app links use `TextLink` (`src/components/text-link.tsx`): `next/link` with HeroUI's link styles, in `--accent-soft-foreground` because `--accent` text misses 4.5:1 on `--background`.

## HeroUI

- v3 (`@heroui/react`, `@heroui/styles`): no provider, compound components (`<Card><Card.Header>`), `onPress` instead of `onClick`. Read the `heroui-react` skill first; v2 examples (`HeroUIProvider`, `@heroui/theme`, `framer-motion`) do not apply.
- `globals.css` imports `@heroui/styles` right after `tailwindcss`; keep that order. HeroUI owns the color tokens (`--background`, `--foreground`, `--accent`, ...), so use them (`bg-background`, `text-foreground`) instead of redefining colors. The local theme overrides are the Geist fonts, a darker light-mode `--muted` and `--danger` (HeroUI's defaults miss WCAG AA 4.5:1 text contrast on `--background`), and no skeleton shimmer under `prefers-reduced-motion`.
- Dark mode is `class="dark"` or `data-theme="dark"` on `<html>`; nothing sets it yet, so the app renders light.
- `@internationalized/date` is installed as a HeroUI peer for the date components.
- Icons come from `@gravity-ui/icons`, the set the HeroUI docs use.
