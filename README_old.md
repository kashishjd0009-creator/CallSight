# CallSight

CallSight is a call center analytics SaaS built as a modular monolith with a React frontend and Express API backend. Users upload CSV files and get dashboard analytics, with AI query capabilities for paid tiers.

## Monorepo Structure

```text
callsight/
├─ apps/
│  ├─ api/                  # Express + TypeScript backend
│  └─ web/                  # React + Vite + Tailwind frontend
└─ packages/
   └─ shared-types/         # Shared TypeScript interfaces
```

## Tech Stack

- API: Node.js, Express, TypeScript, Zod, JWT auth, Prisma
- Web: React, Vite, TailwindCSS, React Router, React Hook Form, Recharts
- AI: Google Gemini via `@google/generative-ai` (`gemini-2.5-flash`)
- DB: PostgreSQL (local or Supabase)
- Testing: Vitest

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL (local) or Supabase project

## Setup

1. Clone and install:

```bash
git clone <your-repo-url>
cd callsight
pnpm install
```

2. Configure API env:

Copy `apps/api/.env.example` to `apps/api/.env` and fill values.

Minimum required:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `GEMINI_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FRONTEND_URL`
- `NODE_ENV`
- `PORT`

3. Configure web env:

Create `apps/web/.env`:

```env
VITE_API_URL="http://localhost:3001"
```

## Database Setup

### Option A: Local PostgreSQL (recommended for local development)

1. Create database `callsight` in pgAdmin or CLI.
2. Set:

```env
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/callsight"
DIRECT_URL="postgresql://postgres:<password>@localhost:5432/callsight"
```

3. Run migration + seed:

```bash
pnpm --filter @callsight/api prisma:migrate
pnpm --filter @callsight/api prisma:seed
```

### Applying Prisma migrations (when to run)

Run migrations whenever you pull changes that update `apps/api/prisma/schema.prisma` or add files under `apps/api/prisma/migrations/`.

**Local development** (interactive; creates a new migration if the schema drifted):

```bash
pnpm --filter @callsight/api prisma:migrate
```

This executes `prisma migrate dev` in `@callsight/api` (uses `DATABASE_URL` from `apps/api/.env`).

**Staging / production** (non-interactive; applies only existing migration files):

```bash
pnpm --filter @callsight/api exec prisma migrate deploy
```

Use this in CI/CD or on a server after install, with `DATABASE_URL` pointing at that environment. It does not generate new migrations.

### Option B: Supabase

1. Create a Supabase project.
2. Copy Session mode PostgreSQL connection string.
3. Set `DATABASE_URL` and `DIRECT_URL` in `apps/api/.env`.
4. Run:

```bash
pnpm --filter @callsight/api prisma:migrate
pnpm --filter @callsight/api prisma:seed
```

(See **Applying Prisma migrations** under Option A for dev vs `migrate deploy` in production.)

## Run Development

Start backend:

```bash
pnpm --filter @callsight/api dev
```

Start frontend:

```bash
pnpm --filter @callsight/web dev
```

Frontend: [http://localhost:5173](http://localhost:5173)  
API: [http://localhost:3001](http://localhost:3001)

## Pipeline observability

The API records structured **pipeline events** (`PipelineEvent` in Prisma) for major steps (HTTP, upload, analytics, Gemini parse, AI execution, auth login/register). Each request shares a **correlation id** from the `X-Correlation-Id` header (or a generated UUID). Events are written to PostgreSQL and echoed to the API terminal via **pino** (level from `LOG_LEVEL`, default `info`). Gemini `AI_GEMINI_PARSE` events store full **user query**, **data schema prompt** (no CSV rows are sent to the model), and **raw model output** in the event payload (see `PROMPTS/7_pipeline_logging_observability.md`).

**`probeSpanId` (required for pairing):** Every row must have a non-null `probeSpanId` so before/after/error lines group correctly in the admin probe viewer. A one-time migration (`20260402200000_pipeline_event_probe_span_required` and related schema) **deletes any existing `PipelineEvent` rows where `probeSpanId` was still null**, then sets the column to `NOT NULL`. **When to care:** before you run migrations against a database that contains old pipeline data, **export or back up** `PipelineEvent` if you need to keep those span-less rows for auditing—they are removed by that migration, not repaired. New environments with no rows (or only rows that already have span ids) are unaffected aside from the schema change.

If you have not applied migrations after pulling changes, create or update tables from the migration history:

**Local:**

```bash
pnpm --filter @callsight/api prisma:migrate
```

**Production / staging** (apply already-committed migration files only):

```bash
pnpm --filter @callsight/api exec prisma migrate deploy
```

There is no separate one-off command beyond the normal Prisma migration queue (`migrate dev` may prompt for a name when you create new migrations locally; `migrate deploy` never does). See **Applying Prisma migrations** under Database Setup for when to use each.

Pipeline persistence errors are logged server-side; a missing `probeSpanId` on a write is rejected in application code before insert.

Example: list all steps for one request in SQL:

```sql
SELECT "step", "phase", "durationMs", "errorCode", "createdAt"
FROM "PipelineEvent"
WHERE "correlationId" = '<paste-id-from-terminal>'
ORDER BY "createdAt";
```

## Useful Commands

```bash
# Run tests (API)
pnpm --filter @callsight/api test

# Type checking (all workspaces)
pnpm typecheck

# Lint (all workspaces)
pnpm lint

# Build web
pnpm --filter @callsight/web build
```

## Seeded Test Users

After running seed:

- `free@test.com` (FREE)
- `pro@test.com` (PRO, near query limit)
- `premium@test.com` (PREMIUM)
- `admin@test.com` (PREMIUM)

Default password: `Test1234!`

## Notes

- AI model is configured as `gemini-2.5-flash`.
- CSV data should not be sent to the LLM; only query intent/schema should be used for parsing.
- Current implementation includes scaffolded modules and progressive feature wiring per build steps.
