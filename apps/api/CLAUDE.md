# @meeting-brain/api

NestJS 12 API, TypeScript 6. Listens on `PORT`, default 3001.

## ESM

The package is ESM (`"type": "module"`, `module: nodenext`):

- Relative imports end in `.js`: `import { AppService } from './app.service.js'`.
- Package subpaths without an `exports` map also need `.js`: `supertest/types.js`.

## Generating code

Use the Nest CLI so modules are wired into `AppModule`:

```bash
pnpm --filter @meeting-brain/api exec nest g resource <name>
```

## Tests

Vitest, not Jest, with globals on (`describe`, `it`, `expect`, `vi`).

- Unit: `src/**/*.spec.ts`, next to the code under test. `pnpm test`.
- E2E: `test/*.e2e-spec.ts`. `pnpm test:e2e` (not part of the root `pnpm test`).

## Lint

ESLint with type-aware `typescript-eslint`. `no-floating-promises` is an error: `await` every promise, or mark a deliberate fire-and-forget with `void`.
