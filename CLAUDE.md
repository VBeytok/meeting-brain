# meeting-brain

pnpm monorepo with two apps; each has its own `CLAUDE.md` with app-specific rules.

- `apps/web`: `@meeting-brain/web`, Next.js, port 3000
- `apps/api`: `@meeting-brain/api`, NestJS + Prisma, port 3001. Env in `apps/api/.env` (copy `.env.example`).
- Postgres 18: `docker-compose.yml` at the root, host port 5432. Start with `docker compose up -d --wait`. Connection: `postgresql://meeting_brain:meeting_brain@localhost:5432/meeting_brain`; env overrides `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

## Commands

Run from the repo root. Root scripts fan out to every app; target one app with its package name:

```bash
pnpm --filter @meeting-brain/api <script>
pnpm --filter @meeting-brain/web add <dep>      # add deps per app, never at the root
```

If `pnpm` is not on PATH, run `corepack enable pnpm` once (the version is pinned in `package.json#packageManager`). Calling `corepack pnpm <script>` is not enough: root scripts run `pnpm -r` internally and fail with `pnpm: command not found`.

A change is done when `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check` passes.

## Keeping docs current

Architecture changes ship with their doc updates in the same change. Architecture means: adding, removing or renaming an app or package; changing ports, env vars, scripts, or how apps talk to each other; swapping or reconfiguring tooling (lint, format, test, build); introducing a convention every future change must follow.

When one of these lands, update every doc it makes stale: this file, the affected `apps/*/CLAUDE.md`, and `README.md`. Remove lines that are no longer true rather than appending corrections. The change is done when every one of those docs matches the code.

## Tooling conventions

- **Prettier** is configured once, at the root (`.prettierrc.json`, `.prettierignore`). Apps carry no Prettier config or dependency. A Claude Code hook (`.claude/hooks/format.sh`) formats every file after Write/Edit; files changed through Bash still need `pnpm format`.
- **ESLint** is per app (`apps/*/eslint.config.mjs`), each ending with `eslint-config-prettier`. Stays on ESLint 9: `eslint-config-next` pulls `eslint-plugin-react`, which does not support ESLint 10 yet.
- Packages with install scripts must be approved in `pnpm-workspace.yaml` under `allowBuilds`.

## Pull requests

Work on a branch off `main`; open a PR with `gh pr create --base main`.

- **Title:** a Conventional Commit, `<type>(<scope>): <description>`. Scope is the app (`api`, `web`) or omitted for repo-wide changes. Imperative mood, under 72 characters. For a multi-commit branch, name the main change (usually the `feat`/`fix`), not the chores around it.
- **Description:** write it from `git log main..HEAD` and `git diff main...HEAD`, not from memory. Sections:
  - `## Summary`: what the PR does and why, 1-3 sentences.
  - `## Changes`: bullets grouped by area (endpoints, data model, tooling, docs). Name new env vars, scripts, migrations and dependencies.
  - `## How to test`: exact commands, including setup a reviewer needs (env file, `docker compose up`, migrations).
  - `## Notes`: decisions a reviewer should question, known gaps, breaking changes. Omit if empty.
- **Before opening:** the done-check passes; if `apps/api` changed, `pnpm --filter @meeting-brain/api test:e2e` passes too.

## Project skills

Skills live in `.claude/skills/`, installed with the `skills` CLI and tracked in `skills-lock.json`. Add new ones with `npx skills add <repo> --skill <name> -a claude-code -y`; without `-a claude-code` they land in `.agents/skills/`, which Claude Code does not read. Update with `npx skills update`.

Read the matching `SKILL.md` before the work it covers:

- NestJS code in `apps/api`: `nestjs-best-practices`
- Prisma schema, migrations or CLI in `apps/api`: `prisma-cli` (run commands through the `db:*` package scripts, which pass `--config prisma7.config.ts`)
- Prisma Client queries in `apps/api`: `prisma-client-api`
- React / Next.js code in `apps/web`: `vercel-react-best-practices`
- HeroUI components: `heroui-react`
- Committing: `git-commit`
- Finishing a feature, before merge: `requesting-code-review`
