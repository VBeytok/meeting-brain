@AGENTS.md

# @meeting-brain/web

Next.js 16 App Router, React 19, Tailwind CSS 4, HeroUI v3. Port 3000.

The `@AGENTS.md` import above and the rules block in `AGENTS.md` are managed by `next dev`. Leave both in place; put project notes in this file.

- Routes live in `src/app/`. Import alias `@/*` maps to `src/*`.
- Tailwind 4 is configured in CSS (`src/app/globals.css`); there is no `tailwind.config.*`. The root `.prettierrc.json` points `tailwindStylesheet` at that file for class sorting, so update it if the stylesheet moves.
- `typecheck` runs `next typegen` before `tsc`: global route types like `LayoutProps` and `PageProps` are generated, and plain `tsc` fails without them.

## API

- Only server code calls `@meeting-brain/api`, through Server Actions and Server Components; the API has no CORS setup, so the browser never calls it directly. Base URL: `API_URL` from `src/lib/api.ts` (env `API_URL`, default `http://localhost:3001`).
- The access token lives in the httpOnly `session` cookie, written by `setSession()` in `src/lib/session.ts`; the cookie expires with the token's `exp`.
- `/register` (`src/app/register/`): the form posts to a Server Action (`actions.ts`) that calls `POST /auth/register`, maps `400`/`409` to field errors and redirects to `/` on success. Forms submit with `onSubmit` + `startTransition(() => formAction(formData))` rather than `action={formAction}`: React resets a form after its `action` runs, which clears the fields when the API rejects them.

## HeroUI

- v3 (`@heroui/react`, `@heroui/styles`): no provider, compound components (`<Card><Card.Header>`), `onPress` instead of `onClick`. Read the `heroui-react` skill first; v2 examples (`HeroUIProvider`, `@heroui/theme`, `framer-motion`) do not apply.
- `globals.css` imports `@heroui/styles` right after `tailwindcss`; keep that order. HeroUI owns the color tokens (`--background`, `--foreground`, `--accent`, ...), so use them (`bg-background`, `text-foreground`) instead of redefining colors. The only local theme override is the Geist fonts.
- Dark mode is `class="dark"` or `data-theme="dark"` on `<html>`; nothing sets it yet, so the app renders light.
- `@internationalized/date` is installed as a HeroUI peer for the date components.
- Icons come from `@gravity-ui/icons`, the set the HeroUI docs use.
