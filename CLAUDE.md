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

A change to `apps/web` UI (pages, components, styles) is also not done until it has been checked visually:

1. Open every affected page on the running dev server through the `playwright` MCP. Walk through each state: empty, filled, validation errors, loading, success. Check desktop and mobile widths.
2. Review what you see against the `ui-ux-pro-max` skill (its priority table, `references/quick-reference.md`, and the pre-delivery checklist in `references/pro-rules.md`).
3. Fix what fails and check again. Report what you checked and what you fixed.

## Keeping docs current

Docs ship in the same commit as the change that makes them stale. Before committing, audit every doc the map names for the files you touched: add what is missing, delete what is no longer true (no appended corrections). Done means every named doc matches the code.

| Files touched                                                              | Docs to audit                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `package.json` (scripts, deps), `pnpm-workspace.yaml`                      | README Setup + Scripts; this file's Commands; `apps/*/CLAUDE.md`             |
| `.env.example`, `apps/api/src/config/`, `src/main.ts`                      | `apps/api/CLAUDE.md` Environment; README Setup                               |
| `docker-compose.yml`, `apps/api/prisma/**`, `prisma*.config.ts`            | README Setup + Database; this file's app list; `apps/api/CLAUDE.md` Database |
| `*.module.ts` (new or removed feature)                                     | `apps/api/CLAUDE.md` Modules                                                 |
| `*.controller.ts`, `**/dto/**`, `*.guard.ts`                               | README API endpoints; `apps/api/CLAUDE.md` Auth                              |
| lint, format, test, build or TS config                                     | this file's Tooling conventions; the app's `CLAUDE.md`; README Scripts       |
| `.claude/settings.json`, `.claude/hooks/`, `skills-lock.json`, `.mcp.json` | this file                                                                    |
| a new rule every future change must follow                                 | this file or the app's `CLAUDE.md`, wherever it applies                      |

The `.claude/hooks/docs-check.sh` hook enforces this: a `git commit` touching mapped files is blocked until the message has a `Docs-Checked:` trailer naming the docs audited (or `Docs-Checked: none needed, <why>`).

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
- **Before opening:** the done-check passes; if `apps/api` changed, `pnpm --filter @meeting-brain/api test:e2e` passes too; if `apps/web` UI changed, the visual check is done.

## MCP servers

Project MCP servers live in `.mcp.json` (add with `claude mcp add --scope project <name> -- <command>`); Claude Code asks each user to approve them on first use.

- `playwright` (`npx @playwright/mcp@0.0.82`): drives a real browser. Use it to check `apps/web` pages against the running dev server.

## Project skills

Skills live in `.claude/skills/`, installed with the `skills` CLI and tracked in `skills-lock.json`. Add new ones with `npx skills add <repo> --skill <name> -a claude-code -y`; without `-a claude-code` they land in `.agents/skills/`, which Claude Code does not read. Update with `npx skills update`.

Read the matching `SKILL.md` before the work it covers:

- NestJS code in `apps/api`: `nestjs-best-practices`
- Prisma schema, migrations or CLI in `apps/api`: `prisma-cli` (run commands through the `db:*` package scripts, which pass `--config prisma7.config.ts`)
- Prisma Client queries in `apps/api`: `prisma-client-api`
- React / Next.js code in `apps/web`: `vercel-react-best-practices`
- HeroUI components: `heroui-react`
- Any `apps/web` UI change, and the visual check before calling it done: `ui-ux-pro-max`
- Committing: `git-commit`
- Finishing a feature, before merge: `requesting-code-review`
