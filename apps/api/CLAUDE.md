# @meeting-brain/api

NestJS 12 API, TypeScript 6. Listens on `PORT`, default 3001.

## ESM

The package is ESM (`"type": "module"`, `module: nodenext`):

- Relative imports end in `.js`: `import { AppService } from './app.service.js'`.
- Package subpaths without an `exports` map also need `.js`: `supertest/types.js`.

## Modules

- `config/`: env validation. `validateEnv` / `Env` (database, JWT) and `validateStorageEnv` / `StorageEnv` (S3), `validateTranscriptionEnv` / `TranscriptionEnv` (AssemblyAI key, fake delay) and `validateAnalysisEnv` / `AnalysisEnv` (Anthropic key, fake delay), combined in `AppModule`'s `ConfigModule.forRoot({ validate })`.
- `prisma/`: `PrismaModule` / `PrismaService`, the only database client.
- `users/`: user records (CQRS): `CreateUserCommand`, `FindUserByEmailQuery`; `UsersRepository`, data access for the `users` table. Exports no providers: other modules go through the buses.
- `auth/`: register and login (CQRS); `AuthService` (password hashing, credential checks, issuing and verifying access tokens) on top of `PasswordHasher`; `JwtAuthGuard` / `@CurrentUser()` for other modules.
- `meetings/`: create, list and get the caller's meetings (CQRS); `MeetingsRepository`, data access for the `meetings` table. `GetMeetingQuery` returns the meeting with its confirmed files and its analysis, fetched with `ListMeetingFilesQuery` and `GetMeetingAnalysisQuery` over the bus.
- `queue/`: `QueueModule` provides `JobQueue`, background jobs on pg-boss in the `pgboss` schema of the app's database (created by pg-boss on start, outside Prisma's migrations). It starts in `onModuleInit` and stops gracefully on shutdown. Feature workers call `define(name, settings)` (retry limit, backoff delay, expiry, concurrency, and `policy`: `standard`, or `stately` for at most one waiting and one running job per `singletonKey`, fixed when the queue is created; creates or updates the queue) and then `work(name, handler)` in `onApplicationBootstrap`; the handler gets `{ data, attempt, isLastAttempt }`, and throwing fails the attempt so pg-boss retries it with exponential backoff. Each worker takes one job and then polls again after 1 s, so `concurrency` (workers per process) is also the throughput. `send(name, data, options)` enqueues (`startAfter` delays a job). Jobs live in Postgres, so they survive restarts. e2e tests boot `AppModule`, so their workers run in the test process (and a running dev API may pick up the same jobs; both run the same code).
- `storage/`: `StorageModule` provides `FileStorage`, an abstract class used as the injection token (`presignUpload`, `presignDownload`, `head`, `read`, `openRead`, `delete`; `read` buffers a small object, `openRead` streams any size), implemented by `S3FileStorage` with the AWS SDK. It keeps two S3 clients: one for the API's own calls (`S3_ENDPOINT`) and one that only signs browser URLs (`S3_PUBLIC_ENDPOINT`), because a presigned URL is bound to its host. Presigned PUTs pass `signableHeaders: ['content-type']`: without it the SDK signs only `host` and drops the type. Presigned GETs set the response type and, for downloads, a `Content-Disposition` from `attachmentDisposition()` (`content-disposition.ts`: RFC 6266, ASCII `filename` plus UTF-8 `filename*`).
- `meeting-files/`: two-phase uploads of a meeting's recordings and transcripts (CQRS): `CreateMeetingFileCommand` (ownership through `GetMeetingQuery`, type and limit checks, presigned PUT valid 1 h), `CompleteMeetingFileUploadCommand` (HEAD the object, compare size and type, `PENDING_UPLOAD` → `QUEUED`; repeating it returns the file), `DeleteMeetingFileCommand` (any status, including a pending upload; object first, then row, so a retry after a failure finishes the job), `RetryMeetingFileCommand` (FAILED → QUEUED and a new job; any other status answers 409), `ProcessMeetingFileCommand` (see processing below), `ListMeetingFilesQuery` (confirmed files of an already-checked meeting, each with a `playbackUrl` and a `downloadUrl` presigned for 15 minutes; signing is local, no storage round trip). `file-types.ts` holds the allow-list: the extension decides the kind and the stored type, and the browser's reported type only has to be one of the extension's aliases; the web app keeps a copy. `MeetingFilesRepository` owns `meeting_files`; storage keys are `meetings/{meetingId}/{random uuid}` and never leave the API.
- `transcription/`: `TranscriptionModule` provides `Transcriber` (abstract class as the token): `submit(stream)` starts a provider job and returns its id, `check(id)` answers processing, completed with a transcript, or failed with the provider's reason. `AssemblyAiTranscriber` (REST over `fetch`) streams the recording to `/v2/upload` (storage never has to be public; video is accepted as is), submits with `speaker_labels` and `language_detection`, and maps utterances to segments (`Speaker A`, ms → s); a 4xx other than auth and rate limits throws `TranscriptionRejectedError` (fail at once), anything else is retried. `FakeTranscriber` is selected when `ASSEMBLYAI_API_KEY` is unset: a canned English transcript `FAKE_TRANSCRIPTION_DELAY_SECONDS` after submit, stateless (the job id carries the outcome and due time, so any process can check it); a recording whose bytes start with `FAKE_TRANSCRIPTION_FAILURE` fails, which the e2e tests use.
- Processing (`meeting-files/processing/`): completing an upload (or retrying a failed file) sends a `meeting-file.process` job (retry limit 3, backoff from 5 s, expiry 30 min, concurrency 4). `MeetingFileProcessor` works the queues. `ProcessMeetingFileCommand` acts only on a QUEUED file, so duplicate or stale jobs do nothing. A transcript file is read (over 20 MB fails), decoded as strict UTF-8 and parsed with `transcripts/parse-transcript.ts` (`.vtt`, `.srt`, `.txt` into `{ language, segments: [{ start?, end?, speaker?, text }] }`), then marked READY or FAILED with a reason. A recording is streamed to the `Transcriber`, becomes TRANSCRIBING with the provider's `transcriptionId`, and a `meeting-file.check-transcription` job (retry limit 5, concurrency 4) runs `CheckTranscriptionCommand`: it acts only while the file is TRANSCRIBING with that id, asks the provider once, and marks READY (an empty transcript fails: no speech), FAILED (`Transcription failed: <reason>`), or sends itself again 5 s later, giving up after 6 h. `TranscriptParseError` and `TranscriptionRejectedError` fail a file at once (retrying would not help); any other error is thrown for the queue to retry, and on the last attempt the file fails with a generic message.
- `analysis/`: `AnalysisModule` provides `MeetingAnalyzer` (abstract class as the token): `analyze(sources)` takes the READY transcripts in upload order and returns `{ language, summary, actionItems: [{ text, owner?, dueDate? }], decisions }`. `ClaudeAnalyzer` calls `claude-sonnet-5-5` through `@anthropic-ai/sdk` with structured output (`output_config.format` JSON schema), the transcript as text from `transcript-text.ts` (`## Part n: name`, `[h:mm:ss] Speaker: text`), and a system prompt that asks for the meeting's language and forbids guessing owners or dates; a 400 or 422, a refusal or running out of tokens throw `AnalysisRejectedError` (fail at once), anything else is retried (the SDK retries rate limits and 5xx itself first). `FakeAnalyzer` is selected when `ANTHROPIC_API_KEY` is unset: a canned analysis naming the parts it got, after `FAKE_ANALYSIS_DELAY_SECONDS`; a transcript containing `FAKE_ANALYSIS_FAILURE` makes it fail.
- `meeting-analysis/`: one analysis per meeting (CQRS). Meeting-files publishes `MeetingFilesChangedEvent` (`FileOutcomes` when a file becomes READY or FAILED; the delete handler for a confirmed file); `MeetingFilesChangedHandler` calls `AnalysisScheduler`, which marks the analysis PENDING (creating it) and sends a `meeting.analyze` job (`stately`, `singletonKey` = meeting id, so a burst of changes collapses into one rebuild; retry limit 3, expiry 10 min, concurrency 2). `AnalyzeMeetingCommand` reads `GetAnalysisInputQuery` (meeting-files) and does nothing while a file is QUEUED, TRANSCRIBING or a pending upload under an hour old (that file's outcome sends a new job); with no READY file it deletes the analysis; otherwise RUNNING → READY with the content and the FAILED file ids as `skippedFileIds`. If files changed while it ran the row is PENDING again: the content is stored but it stays PENDING for the queued rebuild. `RetryMeetingAnalysisCommand` (`POST /meetings/:id/analysis/retry`, ownership through `GetMeetingQuery`) moves FAILED → PENDING and sends a job, else 409. `GetMeetingAnalysisQuery` feeds `GET /meetings/:id`. `MeetingAnalysisRepository` owns `meeting_analyses`.

Data access lives in one injectable per table; CQRS handlers call it, never `PrismaService` directly. Name new ones `<Feature>Repository`.

## Environment

`.env` (gitignored; copy `.env.example`). Validated at startup by `src/config/env.ts`, `src/config/storage-env.ts` (the `S3_*` vars), `src/config/transcription-env.ts` and `src/config/analysis-env.ts`; add new vars to the matching file and to `.env.example`.

- `DATABASE_URL`: required. Postgres from the root `docker-compose.yml`.
- `JWT_SECRET`: required. Signs access tokens. Must be at least 32 characters when `NODE_ENV=production`.
- `JWT_EXPIRES_IN`: optional, default `1h`. A number with a unit (`s`, `m`, `h`, `d`); a bare number is rejected because jsonwebtoken would read it as milliseconds.
- `S3_ENDPOINT`: required. Where the API reaches object storage (MinIO from the root `docker-compose.yml` locally).
- `S3_PUBLIC_ENDPOINT`: optional, defaults to `S3_ENDPOINT`. The origin browsers upload to; presigned URLs are signed for it, so it must match exactly (e.g. when the API reaches storage at `http://minio:9000` but browsers at `https://files.example.com`).
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: required.
- `S3_REGION`: optional, default `us-east-1` (R2 uses `auto`). `S3_FORCE_PATH_STYLE`: optional, `true` (default, MinIO needs it) or `false`.
- `ASSEMBLYAI_API_KEY`: optional outside production, required in production (`src/config/transcription-env.ts`). Set: recordings go to AssemblyAI. Unset: `FakeTranscriber`.
- `FAKE_TRANSCRIPTION_DELAY_SECONDS`: optional, default `0`. How long the fake takes; e2e tests force `0` and an empty key.
- `ANTHROPIC_API_KEY`: optional outside production, required in production (`src/config/analysis-env.ts`). Set: analyses are written by Claude. Unset: `FakeAnalyzer`.
- `FAKE_ANALYSIS_DELAY_SECONDS`: optional, default `0`. How long the fake takes; e2e tests force `0` and an empty key.
- `PORT`: optional, default `3001`. Read directly in `src/main.ts`, not validated.

Read config through `ConfigService<Env, true>` (or `ConfigService<StorageEnv, true>`), not `process.env`.

## Database (Prisma 7)

- Schema: `prisma/schema.prisma`; migrations: `prisma/migrations/`. Tables and columns are snake_case via `@@map` / `@map`. Every `DateTime` column is `@db.Timestamptz(3)`.
- CLI config is `prisma7.config.ts`, not the default name, so every Prisma command needs `--config prisma7.config.ts`. The package scripts pass it.
- The client is generated into `src/generated/prisma/` (gitignored, excluded from lint and Prettier). `postinstall` regenerates it; after a schema change run `pnpm db:generate`. Import from `../generated/prisma/client.js`, never `@prisma/client`.
- Inject `PrismaService` (from `PrismaModule`) instead of creating clients.
- Tables: `users`, `meetings` (`owner_id` → users, cascade), `meeting_files` (`meeting_id` → meetings, cascade; enums `meeting_file_kind` and `meeting_file_status`: `PENDING_UPLOAD`, `QUEUED`, `TRANSCRIBING`, `READY`, `FAILED`; `transcript` JSONB and `error` once processed; `transcription_id`, the provider's job, while TRANSCRIBING), `meeting_analyses` (`meeting_id` unique → meetings, cascade; enum `meeting_analysis_status`: `PENDING`, `RUNNING`, `READY`, `FAILED`; `summary`, `action_items` and `decisions` JSONB, `language`, `skipped_file_ids` uuid[], `error`, `generated_at`). pg-boss keeps its own tables in the `pgboss` schema; Prisma does not manage them. Deleting a meeting cascades its file rows but not the stored objects: whoever adds meeting deletion must also delete the `meetings/{meetingId}/` prefix.

```bash
pnpm --filter @meeting-brain/api db:migrate --name <change>  # create + apply a migration (dev)
pnpm --filter @meeting-brain/api db:deploy                   # apply pending migrations
pnpm --filter @meeting-brain/api db:generate                 # regenerate the client
```

## Validation

A global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) is registered as `APP_PIPE` in `AppModule`, not in `main.ts`, so e2e tests get it too. Request bodies are `class-validator` DTOs.

## Auth

`POST /auth/register` and `POST /auth/login` return `{ accessToken }`, a JWT with `sub` (user id) and `email`. Passwords are hashed with scrypt (`src/auth/password-hasher.ts`). Auth never touches the `users` table: `AuthService` and the register handler send `FindUserByEmailQuery` / `CreateUserCommand`, and `UsersRepository` lowercases emails before every write and lookup.

Protect a route with `@UseGuards(JwtAuthGuard)` (import `AuthModule` in the feature module) and read the caller with `@CurrentUser() user: AuthUser` (`{ id, email }`). Routes are public unless guarded.

## Ownership

User-owned rows (e.g. `meetings.owner_id`) are always queried with the owner in the `where`, never fetched by id and checked afterwards. Another user's row, a missing row and a malformed id all answer `404`.

## CQRS

Use-cases go through `@nestjs/cqrs` (`CqrsModule.forRoot()` in `AppModule`); controllers only build a command or query and hand it to `CommandBus` / `QueryBus`.

- Command (changes state): `src/<feature>/commands/<name>/<name>.command.ts` + `<name>.handler.ts`, e.g. `RegisterUserCommand`.
- Query (reads only): `src/<feature>/queries/<name>/<name>.query.ts` + `<name>.handler.ts`, e.g. `LoginQuery`.
- Extend `Command<Result>` / `Query<Result>` so `execute()` is typed. Register handlers in the feature module's `providers`.

## Generating code

Create a feature module with the Nest CLI so it is wired into `AppModule`, then add the controller, commands and queries by hand (see CQRS). Not `nest g resource`: it generates a CRUD service that bypasses CQRS.

```bash
pnpm --filter @meeting-brain/api exec nest g module <name>
```

## Tests

Vitest, not Jest, with globals on (`describe`, `it`, `expect`, `vi`).

- Unit: `src/**/*.spec.ts`, next to the code under test. `pnpm test`.
- E2E: `test/*.e2e-spec.ts`. `pnpm test:e2e` (not part of the root `pnpm test`). Hits the real database and storage from `.env`: Postgres must be up and migrated, and MinIO up with its bucket (`docker compose up -d --wait`). Use unique emails per test instead of cleaning tables or the bucket. `meeting-files.e2e-spec.ts` uploads real bytes to the presigned URLs with `fetch`, and writes objects directly with its own S3 client to fake a tampered upload.

## Lint

ESLint with type-aware `typescript-eslint`. `no-floating-promises` is an error: `await` every promise, or mark a deliberate fire-and-forget with `void`.
