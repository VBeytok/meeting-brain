# @meeting-brain/api

NestJS 12 API, TypeScript 6. Listens on `PORT`, default 3001.

## ESM

The package is ESM (`"type": "module"`, `module: nodenext`):

- Relative imports end in `.js`: `import { AppService } from './app.service.js'`.
- Package subpaths without an `exports` map also need `.js`: `supertest/types.js`.

## Environment

`.env` (gitignored; copy `.env.example`). Validated at startup by `src/config/env.ts`; add new vars there and to `.env.example`.

- `DATABASE_URL`: required. Postgres from the root `docker-compose.yml`.
- `JWT_SECRET`: required. Signs access tokens.
- `JWT_EXPIRES_IN`: optional, default `1h`.

Read config through `ConfigService<Env, true>`, not `process.env`.

## Database (Prisma 7)

- Schema: `prisma/schema.prisma`; migrations: `prisma/migrations/`. Tables and columns are snake_case via `@@map` / `@map`.
- CLI config is `prisma7.config.ts`, not the default name, so every Prisma command needs `--config prisma7.config.ts`. The package scripts pass it.
- The client is generated into `src/generated/prisma/` (gitignored, excluded from lint and Prettier). `postinstall` regenerates it; after a schema change run `pnpm db:generate`. Import from `../generated/prisma/client.js`, never `@prisma/client`.
- Inject `PrismaService` (from `PrismaModule`) instead of creating clients.

```bash
pnpm --filter @meeting-brain/api db:migrate --name <change>  # create + apply a migration (dev)
pnpm --filter @meeting-brain/api db:deploy                   # apply pending migrations
pnpm --filter @meeting-brain/api db:generate                 # regenerate the client
```

## Validation

A global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) is registered as `APP_PIPE` in `AppModule`, not in `main.ts`, so e2e tests get it too. Request bodies are `class-validator` DTOs.

## Auth

`POST /auth/register` and `POST /auth/login` return `{ accessToken }`, a JWT with `sub` (user id) and `email`. Passwords are hashed with scrypt (`src/auth/password-hasher.ts`).

Protect a route with `@UseGuards(JwtAuthGuard)` (import `AuthModule` in the feature module) and read the caller with `@CurrentUser() user: AuthUser` (`{ id, email }`). Routes are public unless guarded.

## Ownership

User-owned rows (e.g. `meetings.owner_id`) are always queried with the owner in the `where`, never fetched by id and checked afterwards. Another user's row, a missing row and a malformed id all answer `404`.

## CQRS

Use-cases go through `@nestjs/cqrs` (`CqrsModule.forRoot()` in `AppModule`); controllers only build a command or query and hand it to `CommandBus` / `QueryBus`.

- Command (changes state): `src/<feature>/commands/<name>/<name>.command.ts` + `<name>.handler.ts`, e.g. `RegisterUserCommand`.
- Query (reads only): `src/<feature>/queries/<name>/<name>.query.ts` + `<name>.handler.ts`, e.g. `LoginQuery`.
- Extend `Command<Result>` / `Query<Result>` so `execute()` is typed. Register handlers in the feature module's `providers`.

## Generating code

Use the Nest CLI so modules are wired into `AppModule`:

```bash
pnpm --filter @meeting-brain/api exec nest g resource <name>
```

## Tests

Vitest, not Jest, with globals on (`describe`, `it`, `expect`, `vi`).

- Unit: `src/**/*.spec.ts`, next to the code under test. `pnpm test`.
- E2E: `test/*.e2e-spec.ts`. `pnpm test:e2e` (not part of the root `pnpm test`). Hits the real database from `.env`: Postgres must be up and migrated. Use unique emails per test instead of cleaning tables.

## Lint

ESLint with type-aware `typescript-eslint`. `no-floating-promises` is an error: `await` every promise, or mark a deliberate fire-and-forget with `void`.
