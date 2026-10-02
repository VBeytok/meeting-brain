# meeting-brain

pnpm monorepo.

| App                  | Path       | Stack            | Dev URL               |
| -------------------- | ---------- | ---------------- | --------------------- |
| `@meeting-brain/web` | `apps/web` | Next.js + HeroUI | http://localhost:3000 |
| `@meeting-brain/api` | `apps/api` | NestJS + Prisma  | http://localhost:3001 |

## Setup

Requires Node 24+ and pnpm (`corepack enable pnpm` puts the pinned version on PATH).

```bash
pnpm install                          # also generates the Prisma client and installs the Husky git hooks
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait                  # Postgres, MinIO, and a one-off job that creates the bucket
pnpm --filter @meeting-brain/api db:deploy   # apply migrations
```

`apps/api/.env.example` matches the docker-compose services, including the S3 settings for MinIO. Recordings are transcribed by AssemblyAI when `ASSEMBLYAI_API_KEY` is set; without it (development and tests) a fake returns a canned transcript after `FAKE_TRANSCRIPTION_DELAY_SECONDS`, so no key or cost is needed. In production the API refuses to start without the key. Likewise, meetings are summarized by Claude when `ANTHROPIC_API_KEY` is set, and by a fake (after `FAKE_ANALYSIS_DELAY_SECONDS`) without it. The web app reaches the API at `http://localhost:3001`; set `API_URL` (e.g. in `apps/web/.env.local`) to point it elsewhere.

## Web pages

| Path             | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`              | Home, signed-in only (otherwise redirects to `/login`): the user's email, a Log out button, a New meeting button, meeting counts (total, upcoming, held, people) and the 3 latest meetings, each linking to its page; after a create it confirms the new meeting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `/meetings/new`  | New-meeting form, signed-in only: title, date and time (in the browser's timezone), participant emails; calls `POST /meetings`, goes to `/?created=<id>`, where the new meeting is confirmed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/meetings/[id]` | One meeting, signed-in only: title, date and time, upcoming or held, participants, the summary, action items and decisions (with their states: none yet, waiting for files, being written, updating, failed with Retry, written without failed files), and the meeting's files (with their processing status; read a parsed transcript, retry a failed file; the page re-fetches every 5 seconds while a file is processing): drop or choose recordings and transcripts, each uploaded straight to storage with a progress bar and Cancel; play a recording in the page with its transcript alongside (click a line to jump there; the line being spoken is highlighted), download any file under its original name, or delete it after a confirmation; calls `GET /meetings/:id` and the file endpoints through Server Actions. A missing, malformed or someone else's id shows "Meeting not found"; a failed load shows a Try again button |
| `/login`         | Sign-in form; calls `POST /auth/login`, stores the token in an httpOnly cookie, goes to `/`; links to `/register`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/register`      | Sign-up form; calls `POST /auth/register`, stores the token in an httpOnly cookie, goes to `/`; links to `/login`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Database and file storage

Postgres 18 and MinIO run in Docker via `docker-compose.yml`:

```bash
docker compose up -d --wait   # start (data persists in the postgres-data and minio-data volumes)
docker compose down           # stop (add -v to wipe data)
```

Connection: `postgresql://meeting_brain:meeting_brain@localhost:5432/meeting_brain`. If another local Postgres holds 5432, stop it or set `POSTGRES_PORT`. Override credentials with `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`.

The API talks to it through Prisma; schema and migrations live in `apps/api/prisma/`. See `apps/api/CLAUDE.md` for the migration workflow.

MinIO stores meeting files (S3-compatible; S3 or R2 in production). API on http://localhost:9000, console on http://localhost:9001 (sign in with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`, default `meeting_brain` / `meeting_brain_secret`). The `minio-init` service creates the `meeting-brain` bucket and exits. MinIO allows browser uploads (CORS) from `http://localhost:3000`; change it with `MINIO_CORS_ALLOW_ORIGIN`. Ports: `MINIO_PORT`, `MINIO_CONSOLE_PORT`. The image is Chainguard's build (`cgr.dev/chainguard/minio`), because MinIO no longer publishes images to Docker Hub.

## API endpoints

| Method | Path             | Body                  | Success               | Errors                                 |
| ------ | ---------------- | --------------------- | --------------------- | -------------------------------------- |
| POST   | `/auth/register` | `{ email, password }` | `201 { accessToken }` | `400` invalid input, `409` email taken |
| POST   | `/auth/login`    | `{ email, password }` | `200 { accessToken }` | `400` invalid input, `401` bad creds   |

`accessToken` is an HS256 JWT with `sub` (user id) and `email`. Passwords need 8 to 128 characters. Emails are at most 254 characters, case-insensitive and stored lowercased.

Meeting routes need `Authorization: Bearer <accessToken>` (`401` without a valid one) and only see the caller's own meetings:

| Method | Path            | Body                                      | Success                                   | Errors                                        |
| ------ | --------------- | ----------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| POST   | `/meetings`     | `{ title, date, participants: string[] }` | `201` meeting                             | `400` invalid input                           |
| GET    | `/meetings`     |                                           | `200` meeting[]                           |                                               |
| GET    | `/meetings/:id` |                                           | `200` meeting with `files` and `analysis` | `404` missing, not yours, or id is not a UUID |

A meeting is `{ id, title, date, participants }`; `date` is an ISO 8601 date-time with an offset (`Z` or `±hh:mm`, e.g. `2026-10-01T10:00:00+02:00`) and comes back in UTC. `title` is 1 to 200 characters; `participants` holds at most 100 entries of up to 254 characters; neither may be blank. `GET /meetings` returns meetings ordered by `date`, earliest first. Unknown body properties are rejected with `400`.

Files are uploaded in two steps: register the file, PUT the bytes to the returned presigned URL (straight to storage, with `uploadHeaders`), then complete. Same auth and ownership rules: another user's meeting or file, a missing one or a malformed id answers `404`.

| Method | Path                                   | Body                       | Success                                     | Errors                                                                                    |
| ------ | -------------------------------------- | -------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/meetings/:id/files`                  | `{ name, mimeType, size }` | `201 { file, uploadUrl, uploadHeaders }`    | `400` unsupported type, empty or over 1 GB, `404`, `409` the meeting already has 10 files |
| POST   | `/meetings/:id/files/:fileId/complete` |                            | `200` file, now `QUEUED` (again: unchanged) | `404`, `409` nothing in storage yet, or its size or type differs from what was declared   |
| POST   | `/meetings/:id/files/:fileId/retry`    |                            | `200` file, `QUEUED` again                  | `404`, `409` the file has not failed                                                      |
| DELETE | `/meetings/:id/files/:fileId`          |                            | `204`                                       | `404`                                                                                     |

A file is `{ id, name, mimeType, size, kind, status, transcript, error, createdAt }`. `status` goes `PENDING_UPLOAD` → `QUEUED` → `READY` or `FAILED`, with `TRANSCRIBING` between `QUEUED` and the end for recordings. In the background (pg-boss on the same Postgres) a transcript file is parsed, and a recording transcribed (speakers `Speaker A`, `Speaker B`, …, language detected), into `transcript` (`{ language, segments: [{ start?, end?, speaker?, text }] }`, times in seconds); or the file fails with a reason in `error`. Retry sends a failed file back to the queue. Allowed: recordings `.mp3 .m4a .wav .ogg .webm .mp4 .mov` and transcripts `.txt .vtt .srt`; the extension decides `kind` (`RECORDING` or `TRANSCRIPT`), and `mimeType` (the browser's `File.type`, may be empty) must fit it. `uploadUrl` is valid for 1 hour and signs the `Content-Type`, so the PUT must send `uploadHeaders`. `GET /meetings/:id` lists confirmed files only (`status` other than `PENDING_UPLOAD`), oldest first, each with a `playbackUrl` (streams the file with its type) and a `downloadUrl` (the same bytes as `attachment`, under the original name); both are presigned, valid for 15 minutes, and fresh on every fetch. `GET /meetings` has no files. `DELETE` removes a file in any state, row and stored object; deleting a pending upload frees its slot. The 10-file limit counts confirmed files plus uploads registered in the last hour that were not deleted.

Once a meeting's files are processed it gets an analysis: a summary, action items and decisions, written by Claude (`claude-sonnet-5-5`) in the meeting's language. `analysis` is `null` until then, else `{ status, summary, actionItems: [{ text, owner?, dueDate? }], decisions: string[], language, skippedFileIds, error, generatedAt }`. It is rebuilt whenever a file becomes `READY` or `FAILED` or is deleted, and only once no file is still uploading (within the hour its upload URL is valid), `QUEUED` or `TRANSCRIBING` (`status` is `PENDING` meanwhile, `RUNNING` while it is written). It combines the `READY` transcripts in upload order and lists the `FAILED` files it left out in `skippedFileIds`; a rebuild keeps the last `summary` until it finishes. With no `READY` file left, it is removed.

| Method | Path                           | Body | Success                         | Errors                                   |
| ------ | ------------------------------ | ---- | ------------------------------- | ---------------------------------------- |
| POST   | `/meetings/:id/analysis/retry` |      | `200` analysis, `PENDING` again | `404`, `409` the analysis has not failed |

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

API-only scripts (need Postgres running, and MinIO for `test:e2e`; see Setup):

```bash
pnpm --filter @meeting-brain/api test:e2e      # end-to-end tests against the database and storage in apps/api/.env
pnpm --filter @meeting-brain/api db:migrate --name <change>   # create + apply a migration
pnpm --filter @meeting-brain/api db:deploy     # apply pending migrations
pnpm --filter @meeting-brain/api db:generate   # regenerate the Prisma client
```

Prettier is configured once at the root (`.prettierrc.json`); each app has its own `eslint.config.mjs`.

A Husky pre-commit hook (`.husky/pre-commit`) runs `pnpm lint` and `pnpm test`; a failure aborts the commit.
