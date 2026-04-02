# CallSight - ASCII Architecture Diagram

```text
                               +----------------------+
                               |      End Users       |
                               +----------+-----------+
                                          |
                                          v
                            +------------------------------+
                            | apps/web (React + Vite)      |
                            |------------------------------|
                            | Routes:                      |
                            | /login /register             |
                            | /forgot-password             |
                            | /upload /dashboard           |
                            | /query /history /settings    |
                            | /pricing                     |
                            +---------------+--------------+
                                            |
                                    HTTPS / JSON
                                            |
                                            v
                    +------------------------------------------------+
                    | apps/api (Express + TypeScript)                |
                    |------------------------------------------------|
                    | API v1 modules                                 |
                    |  - auth       (JWT, refresh, email flows)      |
                    |  - users      (profile/tier info)              |
                    |  - uploads    (CSV ingest, column detect)      |
                    |  - analytics  (KPIs + chart data engine)       |
                    |  - ai-query   (NL query -> structured query)   |
                    |  - billing    (tier gates + usage limits)      |
                    +------+-----------------------------+------------+
                           |                             |
                           |                             |
                           v                             v
        +--------------------------------+   +-------------------------------+
        | Local File Storage              |   | Gemini API                    |
        |---------------------------------|   |-------------------------------|
        | apps/api/uploads/{userId}/{id}  |   | model: gemini-2.5-flash      |
        | Raw CSV files                   |   | Input: NL query + schema only |
        +----------------+----------------+   +---------------+---------------+
                         |                                    |
                         | read/parse                         | parsed JSON query
                         +----------------------+-------------+
                                                |
                                                v
                                 +------------------------------+
                                 | QueryExecutor (local data)   |
                                 |------------------------------|
                                 | Executes filters/metrics      |
                                 | against parsed CSV records    |
                                 +------------------------------+

                           +------------------------------------+
                           | Prisma ORM                         |
                           |------------------------------------|
                           | models: User, Upload, Report,      |
                           | UsageRecord                         |
                           +----------------+-------------------+
                                            |
                                            v
                           +------------------------------------+
                           | PostgreSQL                         |
                           |------------------------------------|
                           | Local Postgres or Supabase         |
                           +------------------------------------+


Module Interaction (high-level)
-------------------------------

  [auth] ---> provides identity (JWT cookies) --------------------+
                                                                  |
  [users] ---> provides tier/profile -----------------------------+ |
                                                                  | |
  [billing] <--- reads tier + usage, enforces limits ------------+ |
                                                                  | |
  [uploads] ---> stores CSV metadata + local CSV path ------------+-+--> [analytics]
                                                                  |       computes KPIs/charts
                                                                  |
  [ai-query] --> asks Gemini to parse NL -> structured JSON ------+
               executes query locally (no CSV to LLM)


Shared Package
--------------
  packages/shared-types
    - CanonicalCallRecord
    - DashboardKPIs
    - chart data contracts
    - tier related types
```
