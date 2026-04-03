### Lint checks, typecheck, and unit tests

```bash
pnpm lint && pnpm typecheck && pnpm --filter "@callsight/*" test

```

For just API: pnpm --filter @callsight/api test

For just Web: pnpm --filter @callsight/web test
