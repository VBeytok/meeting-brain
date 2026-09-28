# meeting-brain

pnpm monorepo.

| App                  | Path       | Stack   | Dev URL               |
| -------------------- | ---------- | ------- | --------------------- |
| `@meeting-brain/web` | `apps/web` | Next.js | http://localhost:3000 |
| `@meeting-brain/api` | `apps/api` | NestJS  | http://localhost:3001 |

## Setup

Requires Node 24+ and pnpm (`corepack enable pnpm` puts the pinned version on PATH).

```bash
pnpm install
```

## Database

Postgres 18 runs in Docker via `docker-compose.yml`:

```bash
docker compose up -d --wait   # start (data persists in the postgres-data volume)
docker compose down           # stop (add -v to wipe data)
```

Connection: `postgresql://meeting_brain:meeting_brain@localhost:5432/meeting_brain`. If another local Postgres holds 5432, stop it or set `POSTGRES_PORT`. Override credentials with `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`.

## Scripts (from the repo root)

```bash
pnpm dev            # run web + api in watch mode
pnpm dev:web        # web only
pnpm dev:api        # api only
pnpm build          # build all apps
pnpm start          # run built apps
pnpm lint           # ESLint in every app (lint:fix to autofix)
pnpm typecheck      # tsc --noEmit in every app
pnpm test           # unit tests
pnpm format         # Prettier write (format:check for CI)
```

Prettier is configured once at the root (`.prettierrc.json`); each app has its own `eslint.config.mjs`.
