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

## Commands (quick reference)

From the **repo root**, use `pnpm --filter …` so the monorepo links `packages/shared-types` correctly.

|               | Command                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Dev — API     | `pnpm --filter @callsight/api dev`                                                                                |
| Dev — web     | `pnpm --filter @callsight/web dev`                                                                                |
| Build — API   | `pnpm --filter @callsight/api build` → `apps/api/dist`                                                            |
| Build — web   | `pnpm --filter @callsight/web build` → `apps/web/dist` (set `VITE_API_URL` in the environment for a real API URL) |
| Run built API | `cd apps/api && node dist/index.js`                                                                               |

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

## Deploy (Render for the API, Vercel for the web)

A common split: **Render** runs the Node API; **Vercel** hosts the static Vite build. Point the web app at the API with `VITE_API_URL` and point the API at the web with `FRONTEND_URL` (CORS). Use Node **20** everywhere.

### Render — API (Web Service)

Connect the Git repo and use the **repository root** (not `apps/api` alone — pnpm needs the workspace).

| Field             | Value                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build command** | `pnpm install --frozen-lockfile && pnpm --filter @callsight/api prisma:generate && pnpm --filter @callsight/api exec prisma migrate deploy && pnpm --filter @callsight/api build` |
| **Start command** | `cd apps/api && node dist/index.js`                                                                                                                                               |

In the Render dashboard, add every variable your API needs (same ideas as `apps/api/.env.example` / `apps/api/src/config/env.ts`): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, SMTP settings, `FRONTEND_URL` (your Vercel URL, e.g. `https://your-app.vercel.app`), `ADMIN_EMAIL`, etc. Set **`PORT`** to Render’s provided port if Render does not inject it automatically (Render usually sets `PORT`).

After the first deploy, you can shorten the **build command** to omit `prisma migrate deploy` if you prefer to run migrations manually; keep **`prisma:generate`** and **`build`** on every deploy.

### Vercel — web (static frontend)

Use the **repository root** so the install sees the pnpm workspace.

| Field                    | Value                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Install command**      | `pnpm install --frozen-lockfile`                                                                                                                                        |
| **Build command**        | `pnpm --filter @callsight/web build`                                                                                                                                    |
| **Output directory**     | `apps/web/dist`                                                                                                                                                         |
| **Environment variable** | `VITE_API_URL` = your public API base URL (e.g. `https://your-api.onrender.com`) — must be set for **Production** (and Preview if you want previews to hit a real API). |

Framework preset: **Vite** or **Other**; the important part is the install/build/output above.

### Other hosts

- **Database:** production PostgreSQL; migrations: `pnpm --filter @callsight/api exec prisma migrate deploy` when you need to apply committed migration files only.
- **CI:** `.github/workflows/ci.yml` runs lint, typecheck, Prisma generate, and tests on `main`.

For deeper architecture notes, see `PROJECT_OVERVIEW.md`. The previous readme content is preserved in `README_old.md`.
