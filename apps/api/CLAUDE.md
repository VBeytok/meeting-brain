# @meeting-brain/api

NestJS 12 API, TypeScript 6. Listens on `PORT`, default 3001.

## ESM

The package is ESM (`"type": "module"`, `module: nodenext`):

- Relative imports end in `.js`: `import { AppService } from './app.service.js'`.
- Package subpaths without an `exports` map also need `.js`: `supertest/types.js`.

## Modules

- `config/`: env validation. `validateEnv` / `Env` (database, JWT) and `validateStorageEnv` / `StorageEnv` (S3), combined in `AppModule`'s `ConfigModule.forRoot({ validate })`.
- `prisma/`: `PrismaModule` / `PrismaService`, the only database client.
- `users/`: user records (CQRS): `CreateUserCommand`, `FindUserByEmailQuery`; `UsersRepository`, data access for the `users` table. Exports no providers: other modules go through the buses.
- `auth/`: register and login (CQRS); `AuthService` (password hashing, credential checks, issuing and verifying access tokens) on top of `PasswordHasher`; `JwtAuthGuard` / `@CurrentUser()` for other modules.
- `meetings/`: create, list and get the caller's meetings (CQRS); `MeetingsRepository`, data access for the `meetings` table. `GetMeetingQuery` returns the meeting with its confirmed files, fetched with `ListMeetingFilesQuery` over the bus.
- `storage/`: `StorageModule` provides `FileStorage`, an abstract class used as the injection token (`presignUpload`, `presignDownload`, `head`, `delete`), implemented by `S3FileStorage` with the AWS SDK. It keeps two S3 clients: one for the API's own calls (`S3_ENDPOINT`) and one that only signs browser URLs (`S3_PUBLIC_ENDPOINT`), because a presigned URL is bound to its host. Presigned PUTs pass `signableHeaders: ['content-type']`: without it the SDK signs only `host` and drops the type. Presigned GETs set the response type and, for downloads, a `Content-Disposition` from `attachmentDisposition()` (`content-disposition.ts`: RFC 6266, ASCII `filename` plus UTF-8 `filename*`).
- `meeting-files/`: two-phase uploads of a meeting's recordings and transcripts (CQRS): `CreateMeetingFileCommand` (ownership through `GetMeetingQuery`, type and limit checks, presigned PUT valid 1 h), `CompleteMeetingFileUploadCommand` (HEAD the object, compare size and type, `PENDING_UPLOAD` → `QUEUED`; repeating it returns the file), `DeleteMeetingFileCommand` (any status, including a pending upload; object first, then row, so a retry after a failure finishes the job), `ListMeetingFilesQuery` (confirmed files of an already-checked meeting, each with a `playbackUrl` and a `downloadUrl` presigned for 15 minutes; signing is local, no storage round trip). `file-types.ts` holds the allow-list: the extension decides the kind and the stored type, and the browser's reported type only has to be one of the extension's aliases; the web app keeps a copy. `MeetingFilesRepository` owns `meeting_files`; storage keys are `meetings/{meetingId}/{random uuid}` and never leave the API.

Data access lives in one injectable per table; CQRS handlers call it, never `PrismaService` directly. Name new ones `<Feature>Repository`.

## Environment

`.env` (gitignored; copy `.env.example`). Validated at startup by `src/config/env.ts` and, for the `S3_*` storage vars, `src/config/storage-env.ts`; add new vars to the matching file and to `.env.example`.

- `DATABASE_URL`: required. Postgres from the root `docker-compose.yml`.
- `JWT_SECRET`: required. Signs access tokens. Must be at least 32 characters when `NODE_ENV=production`.
- `JWT_EXPIRES_IN`: optional, default `1h`. A number with a unit (`s`, `m`, `h`, `d`); a bare number is rejected because jsonwebtoken would read it as milliseconds.
- `S3_ENDPOINT`: required. Where the API reaches object storage (MinIO from the root `docker-compose.yml` locally).
- `S3_PUBLIC_ENDPOINT`: optional, defaults to `S3_ENDPOINT`. The origin browsers upload to; presigned URLs are signed for it, so it must match exactly (e.g. when the API reaches storage at `http://minio:9000` but browsers at `https://files.example.com`).
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: required.
- `S3_REGION`: optional, default `us-east-1` (R2 uses `auto`). `S3_FORCE_PATH_STYLE`: optional, `true` (default, MinIO needs it) or `false`.
- `PORT`: optional, default `3001`. Read directly in `src/main.ts`, not validated.

Read config through `ConfigService<Env, true>` (or `ConfigService<StorageEnv, true>`), not `process.env`.

## Database (Prisma 7)

- Schema: `prisma/schema.prisma`; migrations: `prisma/migrations/`. Tables and columns are snake_case via `@@map` / `@map`. Every `DateTime` column is `@db.Timestamptz(3)`.
- CLI config is `prisma7.config.ts`, not the default name, so every Prisma command needs `--config prisma7.config.ts`. The package scripts pass it.
- The client is generated into `src/generated/prisma/` (gitignored, excluded from lint and Prettier). `postinstall` regenerates it; after a schema change run `pnpm db:generate`. Import from `../generated/prisma/client.js`, never `@prisma/client`.
- Inject `PrismaService` (from `PrismaModule`) instead of creating clients.
- Tables: `users`, `meetings` (`owner_id` → users, cascade), `meeting_files` (`meeting_id` → meetings, cascade; enums `meeting_file_kind` and `meeting_file_status`). Deleting a meeting cascades its file rows but not the stored objects: whoever adds meeting deletion must also delete the `meetings/{meetingId}/` prefix.

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
