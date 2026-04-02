# CallSight pipeline logs — general overview

This document describes **what** CallSight records in its internal pipeline log (the “probe” trail), **which named steps** exist, and **where** in the product those steps fire. It is meant for product and operations readers, not implementation detail.

---

## Why these logs exist

CallSight keeps a **read-only audit trail** of important work as it moves through the system: sign-in, file uploads, dashboard analytics, and natural-language questions that hit the AI parser. Each entry is tied to a **single user action** (using a correlation id), can be grouped into **spans** (related before/after/error lines), and helps admins answer: _What happened, in what order, and did something fail?_

Sensitive values (such as passwords) are **not** stored in raw form in these payloads.

---

## What every log line has in common

For each step, the system typically stores:

- **When** it ran and **how long** it took (on the “after” line).
- **Which step** of the pipeline it belongs to (see the list below).
- **Whether** it was the start of work (**before**), a successful finish (**after**), or a failure (**error**).
- **Which HTTP call** started the workflow (method and path), when that applies.
- **Which user and upload** were involved, when the backend already knows them.
- A **small summary payload**: high-level counts, ids, domains, or model-output hints — not full CSV contents.

The **Probe Viewer** (admin-only screen) displays these records in three columns: **Before**, **Process**, **Error** (if any), plus **user id** when the backend stored one (see below).

---

## Correlation id and user id (how to read the trail)

### What `correlationId` is

Each **inbound HTTP request** to the API gets a **`correlationId`**: either from the client header `x-correlation-id`, or a new UUID. Every pipeline row triggered during handling that request shares this **same** `correlationId`. That lets you tie **`HTTP_REQUEST`** lines to **`LOAD_CSV_FOR_UPLOAD`**, **`ANALYTICS_*`**, **`AI_*`**, etc., as one user action.

### Why `userId` is not on every row (especially HTTP)

- **`HTTP_REQUEST` + `before`**: Logged **before** route handlers and **`requireAuth`** run. The JWT has not been applied to `req` yet, so **`userId` is usually stored as null** for that line. This is expected.
- **`HTTP_REQUEST` + `after`**: Logged when the response **finishes**. By then, protected routes have run `requireAuth`, so **`userId` is set** from the access token when the route was authenticated.
- **Unauthenticated routes** (for example login/register): There is no session user, so **`userId` stays null** on the HTTP lines. You may still see identity-related detail on **`AUTH_LOGIN`** / **`AUTH_REGISTER`** rows where the app records outcomes.
- **Admin “list probe events”**: `GET /api/v1/probe/events` is **not** written as HTTP pipeline rows (to avoid self-referential noise), so you will not see correlation/user rows for that call in the viewer.

### How to find the user for “any” HTTP request

1. In **Probe Viewer**, open the span for that request and read **`userId`** on the **resolved row** (the UI prefers the **after** phase, then **error**, then **before**, then any stored id). For authenticated traffic, the **after** line usually carries the user.
2. Use the **`correlationId`**: search the viewer (or database) for **other steps** with the same id (**`ANALYTICS_*`**, **`UPLOAD_*`**, etc.). Those rows typically include **`userId`** once the backend knows the user.
3. Paste a **user id** into the viewer search box to filter spans that stored that id on at least one event.

---

## Step names and what they represent

| Step name                | Area of the product  | What it represents (plain language)                                                                                                                                                                                              |
| ------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP_REQUEST**         | Entire API           | One browser or app request hitting the server: start, then finish with status and duration. _The admin log viewer’s own “list logs” request is intentionally not logged, so that screen does not fill up with copies of itself._ |
| **AUTH_REGISTER**        | Sign-up              | Creating a new account: validation, user record creation, success or error.                                                                                                                                                      |
| **AUTH_LOGIN**           | Sign-in              | Checking email and password and issuing a session: success or error.                                                                                                                                                             |
| **UPLOAD_VALIDATE**      | Upload               | Checking the pasted CSV against rules (size, rows, tier limits) before any save.                                                                                                                                                 |
| **UPLOAD_COLUMN_DETECT** | Upload               | Figuring out which CSV columns map to CallSight’s standard fields (agent, queue, times, etc.).                                                                                                                                   |
| **UPLOAD_PERSIST**       | Upload               | Saving the file to storage and storing the upload record so dashboards can use it.                                                                                                                                               |
| **LOAD_CSV_FOR_UPLOAD**  | Dashboard & AI query | Loading the saved upload from storage and preparing call records for analysis.                                                                                                                                                   |
| **ANALYTICS_FILTER**     | Dashboard            | Applying the user’s filters (queue, agent, time window, etc.) to the call list.                                                                                                                                                  |
| **ANALYTICS_COMPUTE**    | Dashboard            | Turning the filtered calls into KPIs and chart numbers shown on the dashboard.                                                                                                                                                   |
| **AI_GEMINI_PARSE**      | AI query             | Sending the user’s natural-language question (and the metric/schema instructions) to Google Gemini and capturing the structured query the model returns or a parse failure.                                                      |
| **AI_QUERY_EXECUTE**     | AI query             | Running that structured query on the loaded call data and producing the number or chart the user asked for.                                                                                                                      |
| **AI_REPORT_PERSIST**    | AI query             | Saving the question, parsed query, and result as a **report** the user can see in history.                                                                                                                                       |
| **AI_BILLING_CHECK**     | _(reserved name)_    | **Not written to the logs today.** The name exists for a possible future “billing gate” step on the trail; billing still runs as part of normal requests, but this dedicated step is unused.                                     |

---

## Where probes are “placed” in the product (feature map)

- **Authentication** — register and login use **`AUTH_REGISTER`** and **`AUTH_LOGIN`**.
- **CSV upload** — validate, map columns, then save with **`UPLOAD_VALIDATE`**, **`UPLOAD_COLUMN_DETECT`**, **`UPLOAD_PERSIST`**.
- **Dashboard and comparisons** — each relevant request loads the file with **`LOAD_CSV_FOR_UPLOAD`**, then **`ANALYTICS_FILTER`** and **`ANALYTICS_COMPUTE`**.
- **Natural language query** — load data (**`LOAD_CSV_FOR_UPLOAD`**), parse with Gemini (**`AI_GEMINI_PARSE`**), compute (**`AI_QUERY_EXECUTE`**), save history (**`AI_REPORT_PERSIST`**).
- **All of the above** sit inside normal web traffic, which is wrapped by **`HTTP_REQUEST`** (except the admin “list probe events” list call, as noted above).

---

## ASCII diagram — modules, two-way flow, and step names on the links

Below, **boxes** are major parts of the system. **Double-headed arrows** show that information travels both ways (requests out, responses back). **Labels on the arrows** are the **pipeline step names** currently stored for those interactions. Steps that happen **only inside the API** after data is already in memory are listed once in the center note.

```
                    ┌─────────────────────────┐
                    │                         │
                    │    CallSight web app    │
                    │    (browser / UI)       │
                    │                         │
                    └───────────┬─────────────┘
                                │
                                │
          ┌─────────────────────▼─────────────────────┐
          │                                           │
          │  HTTP_REQUEST                             │
          │  (every API call: start → finish)         │
          │  *except* the admin “list log rows” call  │
          │                                           │
          └─────────────────────┬─────────────────────┘
                                │
                                │
                    ┌───────────▼───────────────┐
                    │                           │
                    │     CallSight API         │
                    │     (backend)             │
                    │                           │
                    │  ─────────────────────    │
                    │  Inside the API only      │
                    │  (no extra arrows):       │
                    │                           │
                    │   • UPLOAD_VALIDATE       │
                    │   • UPLOAD_COLUMN_DETECT  │
                    │   • ANALYTICS_FILTER      │
                    │   • ANALYTICS_COMPUTE     │
                    │   • AI_QUERY_EXECUTE      │
                    │                           │
                    │  ─────────────────────    │
                    │                           │
                    └───────────┬───────────────┘
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           │                    │                    │
           │                    │                    │
    ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
    │             │      │             │      │             │
    │ PostgreSQL  │      │ CSV file    │      │  Google     │
    │ database    │      │ storage     │      │  Gemini     │
    │             │      │ (per-user   │      │  (AI parse  │
    │             │      │  uploads)   │      │   for NL    │
    │             │      │             │      │   queries)  │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           │                    │                    │
           │                    │                    │
           │   AUTH_REGISTER    │   LOAD_CSV         │   AI_GEMINI_PARSE
           │ ◄─────────────────►│ ◄─────────────────►│ ◄─────────────────►
           │   AUTH_LOGIN       │   FOR_UPLOAD       │
           │                    │                    │
           │   UPLOAD_PERSIST   │                    │
           │   (metadata row)   │                    │
           │                    │                    │
           │   AI_REPORT        │   UPLOAD_PERSIST   │
           │   PERSIST          │   (write new file) │
           │   (saved Q&A row)  │                    │
           │                    │                    │
           │   LOAD_CSV_        │   LOAD_CSV_        │
           │   FOR_UPLOAD       │   FOR_UPLOAD       │
           │   (reads upload    │   (read file)      │
           │    metadata)       │                    │
           │                    │                    │
           └────────────────────┴────────────────────┘

```

### How to read the diagram

- **Web app ↔ API**: dominated by **`HTTP_REQUEST`** lines; they bracket the other steps that occur during the same visit.
- **API ↔ Database**: account creation and login (**`AUTH_REGISTER`**, **`AUTH_LOGIN`**), saving upload metadata and reports (**`UPLOAD_PERSIST`**, **`AI_REPORT_PERSIST`**), and reading upload metadata as part of **`LOAD_CSV_FOR_UPLOAD`**.
- **API ↔ File storage**: reading the CSV bytes (**`LOAD_CSV_FOR_UPLOAD`**) and writing a new upload file (**`UPLOAD_PERSIST`**).
- **API ↔ Gemini**: the dedicated trail **`AI_GEMINI_PARSE`** for natural-language parsing.
- **API “middle”**: **`UPLOAD_VALIDATE`**, **`UPLOAD_COLUMN_DETECT`**, **`ANALYTICS_FILTER`**, **`ANALYTICS_COMPUTE`**, and **`AI_QUERY_EXECUTE`** are logged while work stays inside the backend (no separate service arrows).
- **`AI_BILLING_CHECK`**: not shown on the diagram — **no log lines use this name yet** (reserved only).

---

## Related material

- High-level product architecture (broader than logging): `APPLICATION_ASCII_DIAGRAM.md`

---

_Last updated: April 2026 — includes correlation/user id notes for operators and Probe Viewer user id display._
