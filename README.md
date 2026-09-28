# meeting-brain

pnpm monorepo.

| App                  | Path       | Stack            | Dev URL               |
| -------------------- | ---------- | ---------------- | --------------------- |
| `@meeting-brain/web` | `apps/web` | Next.js + HeroUI | http://localhost:3000 |
| `@meeting-brain/api` | `apps/api` | NestJS + Prisma  | http://localhost:3001 |

## Setup

Requires Node 24+ and pnpm (`corepack enable pnpm` puts the pinned version on PATH).

```bash
pnpm install                          # also generates the Prisma client
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait
pnpm --filter @meeting-brain/api db:deploy   # apply migrations
```

## Database

Postgres 18 runs in Docker via `docker-compose.yml`:

```bash
docker compose up -d --wait   # start (data persists in the postgres-data volume)
docker compose down           # stop (add -v to wipe data)
```

Connection: `postgresql://meeting_brain:meeting_brain@localhost:5432/meeting_brain`. If another local Postgres holds 5432, stop it or set `POSTGRES_PORT`. Override credentials with `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`.

The API talks to it through Prisma; schema and migrations live in `apps/api/prisma/`. See `apps/api/CLAUDE.md` for the migration workflow.

## API endpoints

| Method | Path             | Body                  | Success               | Errors                                 |
| ------ | ---------------- | --------------------- | --------------------- | -------------------------------------- |
| POST   | `/auth/register` | `{ email, password }` | `201 { accessToken }` | `400` invalid input, `409` email taken |
| POST   | `/auth/login`    | `{ email, password }` | `200 { accessToken }` | `400` invalid input, `401` bad creds   |

`accessToken` is an HS256 JWT with `sub` (user id) and `email`. Passwords need 8 to 128 characters. Emails are at most 254 characters, case-insensitive and stored lowercased.

Meeting routes need `Authorization: Bearer <accessToken>` (`401` without a valid one) and only see the caller's own meetings:

| Method | Path            | Body                                      | Success         | Errors                                        |
| ------ | --------------- | ----------------------------------------- | --------------- | --------------------------------------------- |
| POST   | `/meetings`     | `{ title, date, participants: string[] }` | `201` meeting   | `400` invalid input                           |
| GET    | `/meetings`     |                                           | `200` meeting[] |                                               |
| GET    | `/meetings/:id` |                                           | `200` meeting   | `404` missing, not yours, or id is not a UUID |

A meeting is `{ id, title, date, participants }`; `date` is an ISO 8601 date-time with an offset (`Z` or `±hh:mm`, e.g. `2026-10-01T10:00:00+02:00`) and comes back in UTC. `title` is 1 to 200 characters; `participants` holds at most 100 entries of up to 254 characters; neither may be blank. `GET /meetings` returns meetings ordered by `date`, earliest first. Unknown body properties are rejected with `400`.

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

API-only scripts (need Postgres running, see Setup):

```bash
pnpm --filter @meeting-brain/api test:e2e      # end-to-end tests against the database in apps/api/.env
pnpm --filter @meeting-brain/api db:migrate --name <change>   # create + apply a migration
pnpm --filter @meeting-brain/api db:deploy     # apply pending migrations
pnpm --filter @meeting-brain/api db:generate   # regenerate the Prisma client
```

Prettier is configured once at the root (`.prettierrc.json`); each app has its own `eslint.config.mjs`.
