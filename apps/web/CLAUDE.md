@AGENTS.md

# @meeting-brain/web

Next.js 16 App Router, React 19, Tailwind CSS 4, HeroUI v3. Port 3000. The API runs at http://localhost:3001; nothing connects the two yet.

The `@AGENTS.md` import above and the rules block in `AGENTS.md` are managed by `next dev`. Leave both in place; put project notes in this file.

- Routes live in `src/app/`. Import alias `@/*` maps to `src/*`.
- Tailwind 4 is configured in CSS (`src/app/globals.css`); there is no `tailwind.config.*`. The root `.prettierrc.json` points `tailwindStylesheet` at that file for class sorting, so update it if the stylesheet moves.
- `typecheck` runs `next typegen` before `tsc`: global route types like `LayoutProps` and `PageProps` are generated, and plain `tsc` fails without them.

## HeroUI

- v3 (`@heroui/react`, `@heroui/styles`): no provider, compound components (`<Card><Card.Header>`), `onPress` instead of `onClick`. Read the `heroui-react` skill first; v2 examples (`HeroUIProvider`, `@heroui/theme`, `framer-motion`) do not apply.
- `globals.css` imports `@heroui/styles` right after `tailwindcss`; keep that order. HeroUI owns the color tokens (`--background`, `--foreground`, `--accent`, ...), so use them (`bg-background`, `text-foreground`) instead of redefining colors. The only local theme override is the Geist fonts.
- Dark mode is `class="dark"` or `data-theme="dark"` on `<html>`; nothing sets it yet, so the app renders light.
- `@internationalized/date` is installed as a HeroUI peer for the date components.
