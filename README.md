# CallSight

## What does this project do?

CallSight is a call-center analytics SaaS in a pnpm monorepo: an Express + TypeScript API (`apps/api`) and a React + Vite frontend (`apps/web`), plus shared types (`packages/shared-types`). Users sign in, upload call-queue CSV exports, and view dashboards with KPIs and charts. Paid tiers can ask natural-language questions; the API uses Google Gemini only to turn the question into a structured query plan (not raw CSV rows), then runs that plan against stored data. Auth uses JWT and cookies, persistence uses PostgreSQL via Prisma, and the API can record structured pipeline events for observability and admin debugging.

**Project folder structure** (high level):

```text
callsight/
├── apps/
│   ├── api/                    # Backend: Express + TypeScript.
│   │   ├── prisma/             # Prisma schema, SQL migrations, and `seed.ts`.
│   │   ├── uploads/            # Default local storage root for uploaded CSVs (dev).
│   │   └── src/
│   │       ├── config/         # Environment schema and `loadEnv()` (Zod).
│   │       ├── core/           # Cross-cutting HTTP pieces (e.g. error middleware, small shared helpers).
│   │       ├── lib/            # App-wide infrastructure (e.g. Prisma client).
│   │       ├── modules/        # Feature slices: auth, users, uploads, analytics, AI query, billing, observability (routes, services, tests).
│   │       ├── types/          # API-level TypeScript types.
│   │       └── index.ts        # Process entry: loads env, builds the Express app, listens on `PORT`.
│   └── web/                    # Frontend: React + Vite + Tailwind.
│       └── src/
│           ├── components/     # UI building blocks (auth, layout, query UI, shared primitives).
│           ├── pages/          # Route-level screens.
│           ├── contexts/       # React context providers (e.g. auth/session).
│           ├── hooks/          # Reusable React hooks.
│           └── lib/            # Client-side helpers and API client configuration.
├── packages/
│   └── shared-types/           # Shared domain TypeScript types consumed by API and web via the workspace.
├── .github/workflows/          # CI (lint, typecheck, Prisma generate, tests).
├── PROMPTS/                    # Feature specs and design notes (documentation only; not loaded by the app at runtime).
├── eslint.config.mjs           # Repo-wide ESLint (with TypeScript rules).
├── tsconfig.base.json          # Shared TS settings extended by each package.
├── pnpm-workspace.yaml         # Declares `apps/*` and `packages/*` workspaces.
├── PROJECT_OVERVIEW.md         # Longer architecture description.
└── README_old.md               # Archived previous README.
```

## What are the prerequisites?

- **Node.js 20** — required by the root `package.json` `engines` field and GitHub Actions CI.
- **pnpm** (10.x; pinned via `packageManager` in the root `package.json`) — installs and links all workspaces.
- **PostgreSQL 15** — database for Prisma (`DATABASE_URL` / `DIRECT_URL`).
- **Redis 7** — not referenced by this repository’s application code today; include it if your infrastructure or future features (caching, queues, sessions) depend on it.

## How do I set it up?

1. **Clone** the repository and open the repo root in a terminal.

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure environment variables:** copy `apps/api/.env.example` to `apps/api/.env` and fill in every value. The API validates required variables at startup via Zod (`apps/api/src/config/env.ts`). Use a PostgreSQL connection string your Prisma CLI can reach for both `DATABASE_URL` and `DIRECT_URL` (see `.env.example`).

4. **Frontend (local dev):** create `apps/web/.env` with the API base URL, for example:

   ```env
   VITE_API_URL="http://localhost:3001"
   ```

5. **Run database migrations** (from the repo root). **Local development** (interactive; uses `prisma migrate dev`):

   ```bash
   pnpm --filter @callsight/api prisma:migrate
   ```

   Optional: load test data and users:

   ```bash
   pnpm --filter @callsight/api prisma:seed
   ```

6. **Start the servers.** API:

   ```bash
   pnpm --filter @callsight/api dev
   ```

   Web (separate terminal):

   ```bash
   pnpm --filter @callsight/web dev
   ```

   By default the UI is at [http://localhost:5173](http://localhost:5173) and the API at [http://localhost:3001](http://localhost:3001).

## How do I run the tests?

The API and web packages use **Vitest**. From the repo root, run all workspace tests (same pattern as `.github/workflows/ci.yml`):

```bash
pnpm --filter "@callsight/*" test
```

Run a single package:

```bash
pnpm --filter @callsight/api test
pnpm --filter @callsight/web test
```

CI also runs `pnpm lint` and `pnpm typecheck` if you want parity with the quality gate.

## How do I deploy it?

This repo does not ship a Docker image or platform-specific deploy manifest. Deploy by running what CI validates (Node 20, `pnpm install --frozen-lockfile`) and applying the same operational steps your host needs:

1. **Secrets and config:** set all variables from `apps/api/.env.example` (and any host-specific paths) in your environment. Use `FRONTEND_URL` as the real browser origin for CORS.

2. **Database:** point `DATABASE_URL` / `DIRECT_URL` at production PostgreSQL, then apply committed migrations only:

   ```bash
   pnpm --filter @callsight/api exec prisma migrate deploy
   ```

3. **API:** generate the Prisma client (`pnpm --filter @callsight/api prisma:generate`), build with `pnpm --filter @callsight/api build`, then run the compiled entrypoint (for example `node dist/index.js` from `apps/api` after build). Ensure `PORT` and upload/storage paths match your server layout.

4. **Web:** set `VITE_API_URL` to your public API URL **at build time**, then `pnpm --filter @callsight/web build` and serve the `apps/web/dist` static assets from a CDN, object storage + edge, or reverse proxy.

5. **CI:** `.github/workflows/ci.yml` runs lint, typecheck, Prisma generate, and tests on pushes/PRs to `main`; extend it or add a separate workflow when you have a chosen host (VPS, Railway, Render, Fly.io, etc.).

For deeper architecture notes, see `PROJECT_OVERVIEW.md`. The previous readme content is preserved in `README_old.md`.
