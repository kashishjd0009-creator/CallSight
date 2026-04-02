# CallSight — Project Overview

This document describes the **CallSight** repository: what the product is, how the codebase is organized, which technologies power each part, and how the major folders and modules relate to one another. It is intentionally free of source code; it focuses on structure, responsibilities, and tooling.

---

## Big picture

**CallSight** is a call-center analytics SaaS. Users authenticate, upload call-queue CSV exports, and view dashboards with KPIs and charts. Paid tiers can run **natural-language AI queries** against their data: the API uses **Google Gemini** only to parse the user’s question into a structured query (schema and intent—not raw CSV rows), then executes that plan locally against stored records. The backend is a **modular monolith** (single Express app, feature folders). The frontend is a **single-page React app** served by Vite. Data persists in **PostgreSQL** via **Prisma**. Optional **pipeline observability** records structured events (including admin probe viewing) for debugging and auditing.

---

## Monorepo layout

- **Package manager:** **pnpm** (workspace protocol, version pinned in the root `package.json`).
- **Workspaces:** Defined in `pnpm-workspace.yaml` as `apps/*` and `packages/*`.
- **Apps:** `apps/api` (backend), `apps/web` (frontend).
- **Shared library:** `packages/shared-types` (TypeScript types for domain shapes; published as a buildable package in the workspace).

Root-level **TypeScript** uses a shared base config (`tsconfig.base.json`) extended by each package.

---

## Technology stack (what is used for what)

### Runtime and language

- **Node.js** with **TypeScript** across API, web, and shared-types.
- **ES modules** (`"type": "module"`) in application `package.json` files.

### Backend (`apps/api`)

| Technology                 | Role                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Express**                | HTTP server, routing, JSON body parsing, middleware chain.                                             |
| **tsx**                    | Dev server and scripts: run TypeScript without a separate compile step during development.             |
| **tsc**                    | Production build and typechecking for the API.                                                         |
| **Prisma**                 | ORM, migrations, PostgreSQL access; `postinstall` runs `prisma generate`.                              |
| **PostgreSQL**             | Primary database (local or hosted e.g. Supabase). `DIRECT_URL` supports Prisma migrate scenarios.      |
| **Zod**                    | Validating and typing **environment variables** (`loadEnv`) and request/response contracts where used. |
| **jsonwebtoken**           | Access and refresh token signing and verification.                                                     |
| **bcryptjs**               | Password hashing.                                                                                      |
| **cookie-parser**          | Reading cookies (e.g. refresh / auth cookies) in Express.                                              |
| **cors**                   | Restricting browser origins to `FRONTEND_URL` with credentials.                                        |
| **express-rate-limit**     | Rate limiting (e.g. auth routes).                                                                      |
| **nodemailer**             | SMTP email (password reset and related flows).                                                         |
| **@google/generative-ai**  | Gemini client for natural-language query parsing.                                                      |
| **pino**                   | Structured logging; levels controlled by `LOG_LEVEL`.                                                  |
| **luxon**                  | Date/time handling where needed (e.g. reporting windows).                                              |
| **fastest-levenshtein**    | String similarity (e.g. column or label matching in ingest or analytics).                              |
| **supertest** + **Vitest** | HTTP-level and unit tests for the API.                                                                 |

### Frontend (`apps/web`)

| Technology                                              | Role                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Vite**                                                | Dev server, HMR, production bundling.                                            |
| **@vitejs/plugin-react**                                | React JSX transform and Fast Refresh.                                            |
| **React**                                               | UI components and page composition.                                              |
| **react-router-dom**                                    | Client-side routing (`BrowserRouter`, protected routes, navigation).             |
| **Tailwind CSS**                                        | Utility-first styling (`tailwind.config.js`, `postcss.config.js`, `styles.css`). |
| **axios**                                               | HTTP client to the API (auth, uploads, analytics, AI query).                     |
| **react-hook-form** + **@hookform/resolvers** + **zod** | Form state and schema validation (login, register, etc.).                        |
| **react-dropzone**                                      | CSV upload UX on the upload page.                                                |
| **recharts**                                            | Charts on the dashboard.                                                         |
| **Vitest**                                              | Frontend unit tests.                                                             |

### Shared package (`packages/shared-types`)

| Technology     | Role                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **TypeScript** | Defines shared interfaces (e.g. tier union, `CanonicalCallRecord`, dashboard KPI and chart data shapes). |
| **tsc**        | Builds `dist/` for consumption as a workspace package.                                                   |

### Repository tooling (root)

| Technology                       | Role                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **ESLint** (`eslint.config.mjs`) | Linting with **typescript-eslint**; integrates **eslint-config-prettier** to avoid conflicting formatting rules. |
| **Prettier**                     | Consistent formatting; `.prettierrc.json`, `.prettierignore`.                                                    |
| **Husky**                        | Git hooks; **pre-commit** runs **lint-staged** (Prettier + ESLint on staged files).                              |
| **lint-staged**                  | Runs formatters/linters only on changed files.                                                                   |

---

## API modules (feature areas)

Routes are mounted under **`/api/v1`** in `apps/api/src/index.ts`. Each area typically has routes, controllers, services, validators, and tests.

| Module            | Responsibility                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **auth**          | Registration, login, logout, refresh tokens, password reset flows; JWT secrets; **admin email** middleware for privileged operations.                                                           |
| **users**         | Authenticated user profile and related user endpoints.                                                                                                                                          |
| **uploads**       | CSV upload handling, **local disk storage** (`LocalStorageProvider`, files under `apps/api/uploads/`), column detection, CSV-to-record parsing, datetime ingest, loading records for analytics. |
| **analytics**     | KPIs, time series, comparisons, agent leaderboard, filters, reporting timezone, disposition utilities—driven from ingested call data.                                                           |
| **ai-query**      | Gemini-based **query parser**, **query executor** (filters/metrics over local data), normalization, validators, user-facing error messages, billing checks integration.                         |
| **billing**       | Tier snapshot, monthly **AI query usage** (`UsageRecord`), limits for FREE/PRO/PREMIUM, incrementing usage after allowed queries.                                                               |
| **observability** | **Correlation ID** and **probe span** context, **pipeline events** persisted to DB, **terminal logger**, **redaction**, **probe viewer** API for admins (paired with mapper/controller).        |
| **core**          | Cross-cutting **error middleware**, HTTP helpers, validation helpers, shared error types.                                                                                                       |
| **config**        | Central **environment** loading and validation (Zod).                                                                                                                                           |

### Cross-cutting API concerns

- **Request context middleware** attaches observability (correlation id, pipeline logging) early in the pipeline.
- **CORS** and **cookies** align the browser app with the API origin.
- **Error middleware** normalizes errors for API responses.

---

## Web application structure

- **Entry:** `main.tsx` mounts the app with **React StrictMode** and **BrowserRouter**.
- **Routing:** `App.tsx` defines public routes (login, register, forgot password, pricing), protected routes (upload, dashboard, probe viewer, settings), and placeholders for unimplemented paths.
- **Auth:** `ProtectedRoute` loads the session (`/auth/me`-style flow), exposes **AuthSessionContext**, and redirects unauthenticated users. Probe visibility is probed via a lightweight authenticated request to the probe API.
- **Layout:** `AppShell` provides sidebar navigation, tier badge, optional filter slot (dashboard), and logout.
- **Pages:** Dashboard (analytics + charts + AI query panel), Upload, Settings, Probe Viewer (admin pipeline inspection), Login/Register/Forgot password, Pricing.
- **Components:** UI primitives (Button, Card, Input, Badge), auth shell, **TierGate** for feature gating, **QueryPanel** for AI queries.
- **Lib:** API helpers (`auth-api`), navigation helpers, probe payload formatting, query normalization mirroring server behavior where needed, error mapping for display.

Environment: **`VITE_API_URL`** points the browser at the API (e.g. local port 3001).

---

## Database model (Prisma)

Conceptual entities:

- **User** — identity, **Tier** (FREE / PRO / PREMIUM), verification flag, relations to uploads and usage.
- **RefreshSession** — refresh token storage.
- **PasswordResetToken** — reset flow tokens.
- **Upload** — file metadata, storage path, row count, column map JSON, **UploadStatus**.
- **Report** — persisted analytics or AI query results (**ReportType** AUTO vs AI_QUERY), optional query/parsed query, **resultData** JSON.
- **UsageRecord** — per-user, per-month **AI query** counts for billing limits.
- **PipelineEvent** — observability rows: **correlationId**, **probeSpanId** (required for grouping), step/phase/level, optional payload, HTTP fields, **durationMs**, indexes for admin queries.

Migrations live under `apps/api/prisma/migrations/`. **Seed** script: `apps/api/prisma/seed.ts`.

---

## Pipeline observability (conceptual)

The API records **pipeline events** for major steps (HTTP, upload, analytics, Gemini parse, AI execution, auth). Requests share a **correlation id** (header or generated). Events are stored in PostgreSQL and echoed to the terminal via **pino**. Admin-facing **probe** endpoints allow inspection of events (with redaction where appropriate). See `PIPELINE_LOGS_OVERVIEW.md` for operational detail.

---

## Full project structure (annotated)

The tree below is a logical view of the repository. It omits `node_modules`, build artifacts like `dist/`, and per-file lockfile noise. Runtime CSV blobs under `apps/api/uploads/` are summarized as a folder pattern.

```text
callsight/  (root; package name "callsight")
├── .gitignore
├── .husky/                    # Git hooks (e.g. pre-commit → lint-staged)
├── .prettierignore
├── .prettierrc.json
├── eslint.config.mjs          # ESLint flat config (TypeScript + Prettier compatibility)
├── package.json               # Root scripts: lint, format, typecheck; husky prepare
├── package-lock.json          # (also pnpm-lock.yaml — pnpm is the intended package manager)
├── pnpm-lock.yaml
├── pnpm-workspace.yaml        # workspaces: apps/*, packages/*
├── tsconfig.json              # TypeScript project references to api, web, shared-types
├── tsconfig.base.json         # Shared compiler options for packages
│
├── README.md                  # Setup, env vars, migrations, run commands
├── PROJECT_OVERVIEW.md        # This file
├── APPLICATION_ASCII_DIAGRAM.md
├── PIPELINE_LOGS_OVERVIEW.md
├── users.md                   # Notes (e.g. test users reference)
│
├── Call Queues Report - Total Calls _ 03_31_2026.csv   # Sample/report CSV at repo root
├── jd_fusion_dashboard.html   # Standalone HTML prototype/asset (not the React app)
├── jd_fusion_v3.html
│
├── PROMPTS/                   # Build/spec prompts for features (numbered markdown docs)
│   ├── 1_master_prompt.md
│   ├── …                      # UI, analytics, AI query, probe viewer, etc.
│   └── 16_authenticated_app_shell_sidebar.md
│
├── apps/
│   ├── api/                   # @callsight/api — Express backend
│   │   ├── .env.example       # Template for secrets and URLs (copy to .env)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/    # SQL migration history
│   │   ├── src/
│   │   │   ├── index.ts       # App bootstrap, middleware, route mounting
│   │   │   ├── config/        # Environment loading
│   │   │   ├── core/          # Errors, HTTP, validation, error middleware
│   │   │   ├── lib/           # Prisma client singleton
│   │   │   ├── types/         # Express augmentation if any
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── users/
│   │   │       ├── uploads/
│   │   │       ├── analytics/
│   │   │       ├── ai-query/
│   │   │       ├── billing/
│   │   │       └── observability/
│   │   └── uploads/           # Local storage root for user CSV files (runtime; gitignored in whole or part)
│   │
│   └── web/                   # @callsight/web — Vite + React frontend
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── tsconfig.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles.css
│           ├── vite-env.d.ts
│           ├── components/    # layout, auth, ui, query, tier gate
│           ├── contexts/      # auth session
│           ├── pages/         # route-level screens
│           └── lib/           # API clients, nav, probe helpers, normalization tests
│
└── packages/
    └── shared-types/          # @callsight/shared-types — shared TS types (build output in dist/)
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

---

## Common commands (reference)

- Install: `pnpm install` (from repository root).
- API dev: `pnpm --filter @callsight/api dev`.
- Web dev: `pnpm --filter @callsight/web dev`.
- API tests: `pnpm --filter @callsight/api test`.
- Repo-wide typecheck: `pnpm typecheck`.
- Lint / format: `pnpm lint`, `pnpm format` (and `:write` / `:fix` variants where defined).

Database: Prisma migrate and seed via the API package scripts (see `README.md`).

---

## Design notes

- **Security:** JWT-based auth with refresh flow; CORS locked to the frontend origin; AI parsing does not send CSV row content to the model (schema/intent only).
- **Tiers:** FREE has no AI queries in the billing service snapshot; PRO has a monthly cap; PREMIUM is unlimited for the defined checks.
- **shared-types:** Present as a first-class package for domain typings; apps may consume it when wired as workspace dependencies (the canonical shapes include dashboard KPIs and chart series types).

This overview should be enough to onboard someone to the repository layout, stack choices, and module boundaries without reading the implementation line by line.
