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
- Signed-in pages share `AppHeader` (`src/components/app-header.tsx`): the brand, the email and a Log out form (`logout` Server Action in `src/app/actions.ts`).
- `/` (`src/app/page.tsx`): a New meeting button and `Dashboard` (`dashboard.tsx`), which loads `GET /meetings` inside `<Suspense>` with a skeleton fallback and shows an alert when the API fails. With `?created=<id>` (set by the create-meeting action) it shows a success alert naming that meeting, since a past-dated meeting may not be among the latest 3. Dates are formatted on the server, so they use the server's timezone.
- `/meetings/new` (`src/app/meetings/new/`): the form posts to the `createMeeting` Server Action, same `onSubmit` pattern as the auth forms; API `400` messages map to field errors, success redirects to `/?created=<id>`. Participants are typed or pasted (split on spaces, commas, semicolons, newlines), checked against the HTML email pattern, de-duplicated case-insensitively and sent as repeated `participants` fields. The field is `type="text"` with `inputMode="email"`, because an email input strips the newlines of a pasted column; a paste holding several addresses becomes tags at once. Its error (client check or server answer) lives in local state and clears when the field or the list changes: driven straight from the action state, `isInvalid` would set a custom validity that blocks every later submit. The date is picked in the browser's timezone and converted to an ISO instant on the client before submit. `MeetingDateField` renders on the client only (`useSyncExternalStore`, skeleton on the server): the date segments follow the browser's locale and timezone, and Node and the browser even format the AM/PM space differently, so server HTML would not hydrate. With minute granularity the DatePicker commits only once a time is set, so its popover carries a `TimeField` next to the calendar.
- `/meetings/[id]` (`src/app/meetings/[id]/`): the page checks the session and renders the header; `MeetingDetails` loads the meeting inside `<Suspense key={id}>` with a skeleton fallback. `getMeeting()` in `src/lib/meetings.ts` returns `found`, `not-found` or `error` and is wrapped in `React.cache`, so `generateMetadata` (the tab title) and the page share one API call. `not-found` calls `notFound()`, which renders the segment's `not-found.tsx` (it draws its own header); `error` shows an alert with `RetryButton` (`src/components/retry-button.tsx`, `router.refresh()` in a transition). Dashboard rows link here as whole cards.
- Date formats and `isUpcoming()` live in `src/lib/dates.ts`; the date badge, the Upcoming/Held chip and the people count in `src/components/meeting-parts.tsx`, shared by the dashboard and the meeting page.
- Grids whose items hold long unbroken text (emails) use `minmax(0,1fr)` tracks: a bare `1fr` or an implicit track grows to the content's min width and scrolls the page sideways on phones.
- In-app links use `TextLink` (`src/components/text-link.tsx`): `next/link` with HeroUI's link styles, in `--accent-soft-foreground` because `--accent` text misses 4.5:1 on `--background`.
- Navigation that reads as an action (New meeting) uses `ButtonLink` (`src/components/button-link.tsx`): `next/link` with HeroUI's `buttonVariants`, so it stays a real link.

## HeroUI

- v3 (`@heroui/react`, `@heroui/styles`): no provider, compound components (`<Card><Card.Header>`), `onPress` instead of `onClick`. Read the `heroui-react` skill first; v2 examples (`HeroUIProvider`, `@heroui/theme`, `framer-motion`) do not apply.
- `globals.css` imports `@heroui/styles` right after `tailwindcss`; keep that order. HeroUI owns the color tokens (`--background`, `--foreground`, `--accent`, ...), so use them (`bg-background`, `text-foreground`) instead of redefining colors. The local theme overrides are the Geist fonts, a darker light-mode `--muted` and `--danger` (HeroUI's defaults miss WCAG AA 4.5:1 text contrast on `--background`), and no skeleton shimmer under `prefers-reduced-motion`.
- Dark mode is `class="dark"` or `data-theme="dark"` on `<html>`; nothing sets it yet, so the app renders light.
- `@internationalized/date` is installed as a HeroUI peer for the date components.
- Icons come from `@gravity-ui/icons`, the set the HeroUI docs use.
