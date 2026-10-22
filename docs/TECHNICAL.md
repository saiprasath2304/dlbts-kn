# DLBTS KN – technical guide

> For developers. Organisers only need the main [README](../README.md) and [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).
> Docker is needed **only** to run the automated tests or a local copy of the database.

A bilingual (English / தமிழ்) web application for judging competitions: organisers set up
groups, events, participants, judges and evaluation criteria; judges score on their phones
with automatic saving that survives network loss; organisers monitor progress live, handle
reopening and correction requests, resolve ties, finalize results and produce PDF reports.

Built with **SvelteKit 3 + Svelte 5 + TypeScript** and **Supabase** (Postgres, Auth, Row Level
Security, Realtime).

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Setting up a Supabase project](#setting-up-a-supabase-project)
- [First administrator](#first-administrator)
- [Judge accounts](#judge-accounts)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [Building and deploying](#building-and-deploying)
- [Email delivery](#email-delivery)
- [PDF reports and Tamil fonts](#pdf-reports-and-tamil-fonts)
- [Running an event](#running-an-event)
- [Backup and recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Reference project notes](#reference-project-notes)
- [Known limitations](#known-limitations)

---

## What it does

**Judges** sign in with a username such as `judge01grp1sc` and land directly on their own
events (straight onto the scoring page if they have only one). For each participant they
enter a mark per criterion (`__ / 25`), see the total update instantly, and never press
“Save”: marks are saved automatically, kept on the device while offline, and synced when the
connection returns. When finished they review and submit; the submission is then locked on
the server. To change it they ask the organisers to reopen it.

**Administrators** manage groups, events, criteria, participants (manual or CSV/Excel
import), judge accounts and assignments; watch live progress; approve or reject reopening
requests; send correction requests; correct a mark with a mandatory reason; resolve ties;
finalize results; download or email PDF reports; and review a tamper-proof audit log.

Key rules enforced by the database (not just the UI):

| Rule                                                                                 | Where it is enforced                                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| A judge only sees their own assignments, submissions and marks                       | Row Level Security policies                                                                                |
| Marks are within `0..max`, respect the event's decimal places, belong to the event   | `validate_score` trigger + `save_scores`                                                                   |
| Submitted marks cannot change                                                        | `validate_score` trigger (also blocks the service role) + row locks in `save_scores` / `submit_submission` |
| Totals and aggregates are computed by the database                                   | `submit_submission`, `event_results_internal`                                                              |
| Final aggregate = **sum of every required judge's total**                            | `event_results_internal`                                                                                   |
| Results stay hidden until every required judge has submitted complete marks          | `event_results_internal` returns no participants until complete                                            |
| Ties are flagged, never broken automatically; finalization is blocked until resolved | `event_results_internal`, `resolve_tie`, `finalize_event_results`                                          |
| Any later change invalidates a finalization                                          | triggers on scores, criteria, assignments, entries                                                         |
| Changes after scoring has started need an explicit reason                            | guard triggers (`CONFIRMATION_REQUIRED`)                                                                   |
| Audit log, score history and submission snapshots are append-only                    | `forbid_modification` triggers (UPDATE/DELETE/TRUNCATE)                                                    |
| Roles can only be set by trusted server code                                         | `protect_profiles` trigger + no write grants                                                               |

## Architecture

```
Browser (SvelteKit pages, Svelte 5)
  │  forms / fetch                       IndexedDB: unsent marks only (no credentials)
  ▼
SvelteKit server (Node or Vercel)
  ├─ hooks.server.ts   session from httpOnly cookies → active profile → role guard
  ├─ +page.server.ts   loads & form actions using the *user's* Supabase session (RLS applies)
  ├─ /api/judge/scores autosave endpoint → save_scores()
  ├─ service-role client ONLY for: creating judges, setting passwords, (de)activating accounts
  └─ PDF (pdfkit + embedded Noto fonts), email (Resend REST API)
  ▼
Supabase
  ├─ Auth      username → internal identifier (judge01grp1sc@judges.invalid)
  ├─ Postgres  tables + RLS + SECURITY DEFINER functions for every state change
  └─ Realtime  admin dashboard listens to submission/request changes
```

### Data model (main tables)

| Table                                                          | Purpose                                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `profiles`                                                     | One row per auth user: `username`, `display_name`, `role` (`admin`/`judge`), `is_active`       |
| `groups`, `events`                                             | Configurable structure; short `code`s are used in usernames (`grp1`, `sc`)                     |
| `participants`, `event_participants`                           | Stable participant/team ids and their event entries (one participant can enter several events) |
| `evaluation_criteria`                                          | Per-event criteria with `max_marks`, order, active flag                                        |
| `judge_assignments`                                            | Which judges must judge which event (creating one creates the `submission`)                    |
| `submissions`                                                  | One per (event, judge): status, version, round, submitted_at/by                                |
| `criterion_scores`                                             | One mark per (submission, participant, criterion), versioned                                   |
| `score_history`, `submission_rounds`, `submission_transitions` | Append-only history of every mark change, every (re)submission snapshot and every state change |
| `reopening_requests`, `correction_requests`                    | Request workflows                                                                              |
| `tie_resolutions`, `result_finalizations`                      | Tie decisions (with original aggregates and reason) and immutable result snapshots             |
| `audit_logs`                                                   | Append-only audit trail                                                                        |
| `report_records`, `app_settings`                               | Report generation/email delivery log; title, default language, username patterns               |

Submission states: `not_started → in_progress → submitted → reopening_requested → reopened →
resubmitted`, plus `correction_requested` (admin unlocks for a correction). Editable states:
not started, in progress, reopened, correction requested.

Result states per event: `judging_in_progress → awaiting_tie_resolution →
ready_for_finalization → finalized`.

### Source layout

```
supabase/
  config.toml                 local stack; signups disabled
  migrations/                 versioned SQL (schema, security, workflows, results, admin ops, privileges)
src/
  env.ts                      validated environment variables (startup check)
  hooks.server.ts             auth, role guard, security headers, language
  lib/
    scoring.ts                mark parsing/validation, totals, ranking, tie validation (pure)
    usernames.ts              username/password patterns, internal identifiers
    i18n/                     en.ts, ta.ts (type-checked to have identical keys)
    offline/                  IndexedDB draft store + autosave/sync controller
    import/participants.ts    CSV/XLSX row mapping and validation
    server/                   Supabase clients, accounts, reports (PDF), email, settings
  routes/
    login, logout, lang
    judge/                    my events, scoring, review & submit, receipt
    admin/                    dashboard, groups, events, participants (+import/export), judges,
                              assignments, submissions, requests, results, reports, audit, settings
    api/judge/scores          autosave endpoint
scripts/                      create-admin.ts, dlbts-kn-2026.ts (event data), generate-setup-sql.ts
supabase/setup/               01_schema.sql + 02_dlbts_kn_2026.sql for the Supabase SQL editor
tests/
  integration/                real Supabase: RLS, workflows, results, import, audit
  e2e/                        Playwright: judge & admin flows, offline, mobile layout
```

## Prerequisites

- Node.js **22.18+** (24 recommended; scripts are TypeScript run directly by Node)
- npm 10+
- Docker Desktop (for the local Supabase stack and integration/e2e tests)
- A Supabase project for production (free tier is fine for one event)

## Local development

```bash
cd dlts-kn
npm install
npx playwright install chromium      # only needed for end-to-end tests

npm run db:start                     # starts local Supabase in Docker (first run downloads images)
npx supabase status                  # prints the local URL and keys
cp .env.example .env                 # then paste PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY,
                                     # and SUPABASE_SERVICE_ROLE_KEY (the sb_secret_... key)
npm run db:reset                     # applies all migrations to a fresh local database
npm run dev                          # http://localhost:5173
```

To load the DLBTS KN 2026 events and accounts locally, run `supabase/setup/02_dlbts_kn_2026.sql` (after setting the admin password in it) with `docker exec -i supabase_db_dlts-kn psql -U postgres < file.sql`.

Useful commands:

| Command                           | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run db:reset`                | Recreate the local database from migrations (deletes local data) |
| `npm run db:lint`                 | Static checks of SQL functions (plpgsql_check)                   |
| `npm run db:types`                | Regenerate `src/lib/database.types.ts` after changing the schema |
| `npm run check`                   | Svelte/TypeScript type check                                     |
| `npm run lint` / `npm run format` | Prettier + ESLint                                                |

### Changing the database

Add a new file `supabase/migrations/<timestamp>_<name>.sql` (never edit an applied
migration), run `npm run db:reset`, then `npm run db:types`. Any new function must be
explicitly granted: the last migration revokes `EXECUTE` from `anon`/`authenticated` by
default — follow the pattern in `20261022100600_privileges.sql`.

Rollback: migrations only create objects. Locally, `npm run db:reset` rebuilds from scratch.
In production, do not drop tables that hold marks; write a forward migration that reverts the
change, or restore from a backup (see below).

## Setting up a Supabase project

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL**, the
   **publishable key** and the **secret key** (Project Settings → API Keys).
2. **Authentication → Sign In / Providers**
   - Turn **off** “Allow new users to sign up”. Accounts are created only by admins through
     the app (server-side, with the secret key).
   - Keep the **Email** provider **enabled** (judges log in with an internal email-shaped
     identifier). Turn **off** “Confirm email”.
   - No SMTP, password-recovery or magic-link setup is needed: the app never sends auth email.
3. **Authentication → Rate Limits**: raise “sign-ups and sign-ins” (default 30 per 5 minutes
   per IP) to e.g. **300**. Logins are performed by the app server, so Supabase sees one IP
   address for every judge; the default can lock out a room full of judges logging in at once.
4. Apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations/* in order
   ```
5. (Optional) Authentication → Sessions: set a time-box such as 24 hours.

Realtime needs no extra setup: the migrations add `submissions`, `reopening_requests` and
`correction_requests` to the `supabase_realtime` publication, and RLS limits what each user
receives.

## First administrator

There is intentionally **no web page** that can create an administrator. An operator who has
the secret key runs:

```bash
npm run create-admin -- --username admin --name "Chief Organiser"
```

The password is asked for twice with hidden input (min. 8 characters); it is never passed on
the command line. For automation, `ADMIN_PASSWORD=... npm run create-admin -- ...` also
works. The script reads `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`AUTH_EMAIL_DOMAIN` from `.env`, so point `.env` at the production project when running it
(or export those variables). Create a second admin the same way if you want a backup person.

## Judge accounts

- Admins create judges under **Judges → New judge account**. Choosing an event fills in a
  suggested username and password from the patterns in **Settings** (default
  `judge{nn}{group}{event}` → `judge01grp1sc`, password `pwd{nn}{group}{event}` →
  `pwd01grp1sc`). Both can be edited; any password of 6–72 characters is accepted.
- The username is converted on the server to an internal identifier
  `judge01grp1sc@<AUTH_EMAIL_DOMAIN>`. The domain must be a reserved, non-deliverable TLD
  (`.invalid`, `.test`, `.example`, `.localhost`), so no mail can ever be delivered there.
  The mapping is deterministic, so nothing about it is exposed and usernames cannot be
  enumerated: the login form gives the same message for unknown users and wrong passwords.
- Passwords go straight to Supabase Auth (bcrypt). They are not stored, logged, exported or
  written to the audit log; hand them to judges in person.
- **Forgotten password:** an admin sets a new one (Judges → Edit → Set new password).
- **Deactivate** blocks sign-in (auth ban) and cuts access immediately (RLS checks
  `profiles.is_active`). A deactivated judge no longer counts toward an event's required
  judges.
- Admins cannot create or promote admins from the UI; roles change only through trusted code.

## Environment variables

| Variable                          | Required                      | Exposed to browser | Purpose                                                                    |
| --------------------------------- | ----------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | yes                           | yes                | Supabase project URL                                                       |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes                           | yes                | Publishable (`sb_publishable_…`) or legacy anon key                        |
| `SUPABASE_SERVICE_ROLE_KEY`       | yes                           | **no**             | Secret (`sb_secret_…`) or legacy service-role key, server only             |
| `AUTH_EMAIL_DOMAIN`               | no (default `judges.invalid`) | no                 | Namespace for internal auth identifiers. Do not change once accounts exist |
| `SESSION_MAX_AGE_HOURS`           | no (default 12)               | no                 | Login cookie lifetime                                                      |
| `ORIGIN`                          | Node deployments              | n/a (build time)   | Public URL, e.g. `https://judging.example.org`                             |
| `REPORT_EMAIL_TO`                 | no                            | no                 | Recipient of emailed reports                                               |
| `RESEND_API_KEY`                  | no                            | no                 | Resend API key                                                             |
| `EMAIL_FROM`                      | no                            | no                 | Verified sender, e.g. `Results <results@example.org>`                      |

Variables are declared and validated in `src/env.ts` (SvelteKit 3 `defineEnvVars`). If one
is missing or wrong the server refuses to start and names the variable — without printing
its value. Private variables can only be imported from server code; a client import fails
the build. `npm run build` was checked to contain no secret in browser bundles.

## Tests

```bash
npm test                    # unit tests (no database needed)
npm run test:integration    # needs `npm run db:start` and a local .env
npm run test:e2e            # needs the local stack; builds the app and drives Chromium
npm run test:all            # all three
```

| Suite                                                           | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (`src/**/*.test.ts`, 60 tests)                             | mark parsing/limits/decimals, totals without float drift, 90+85+92=267 aggregation, competition ranking, tie detection and rank validation, podium with fewer than 3 places; username/password patterns; English/Tamil key and placeholder parity; CSV/XLSX row mapping, row-level errors, duplicate detection, CSV formula-injection escaping; autosave debounce, offline queue, retry, recovery after refresh, version conflicts, locked submission, draft clearing; PDF content (finalized only, pending events show no ranks, progress report marked NOT FINAL), Tamil font embedding, Tamil text extraction and glyph-reordering check; email (optional, idempotency header, failures without leaking the key)                                                                  |
| Integration (`tests/integration`, 44 tests, incl. yearly reset) | Real Supabase with real users: anon reads nothing and cannot sign up; judges see only their own events/participants/submissions/marks, cannot use another event's ids, cannot write tables, change roles, call admin or internal functions, or insert audit rows; deactivation cuts access; autosave validation and conflicts; incomplete submission rejected; lock enforced even for the service role; reopening request/approve/reject/resubmit with full history; correction requests; aggregation across judges; hidden results until complete; ties block finalization; tie resolution; snapshot finalization; admin correction invalidates finalization and is audited; atomic import (bad file imports nothing); reasons required after scoring starts; append-only audit log |
| End-to-end (`tests/e2e`, 15 tests)                              | Judge login lands on the event, live totals, autosave, invalid-mark message, persistence across reload; offline entry then sync; draft recovery after reload while the API is unreachable; review → final submit → locked UI and HTTP 409 from the API; judge blocked from admin pages and other events (404); admin dashboard progress and live Realtime update; finalize; PDF download without email config; Tamil switch (including `<html lang>`); admin creates a judge who can sign in; generic login errors; small-phone layout, 18px+ inputs, 48px+ touch targets                                                                                                                                                                                                            |

The integration and e2e suites refuse to run against a non-local Supabase URL. They create
uniquely named fixtures, so they can run repeatedly without `db:reset`.

## Building and deploying

```bash
npm run build      # production build (Node server in ./build by default)
npm start          # node --env-file-if-exists=.env build   (PORT=3000 by default)
```

### Option A — any Node.js host (VM, Docker, Render, Railway, Fly…)

1. Set the environment variables (above). Build with `ORIGIN` set to the public URL:
   `ORIGIN=https://judging.example.org npm run build`.
   - Alternatively, behind a reverse proxy that sets `X-Forwarded-Proto`/`X-Forwarded-Host`,
     run the server with `PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host`.
   - Without either, every form submission (including login) is rejected with
     “Cross-site POST form submissions are forbidden”.
2. Run `node build` (or `npm start`) behind HTTPS. Session cookies are `Secure`, `HttpOnly`,
   `SameSite=Lax`.
3. One instance is enough for a typical event. The login rate limiter is in memory per
   instance; Supabase's own limits still apply across instances.

### Option B — Vercel

1. Import the repository; set the project root to `dlts-kn`.
2. Add the environment variables in Project Settings (`ORIGIN` is not needed).
3. Deploy. The build detects `VERCEL=1` and uses `@sveltejs/adapter-vercel` (Node 22 runtime).

The Vercel build was verified in a Linux container (functions are generated and `pdfkit`,
`fontkit` and `exceljs` are traced into them). On **Windows**, a local `VERCEL=1 npm run
build` fails inside `@vercel/nft` (`EISDIR … readlink`) — a known tool/Node incompatibility;
Vercel's own Linux build is unaffected.

### Differences between targets

| Concern        | Node host                                                     | Vercel                                                                                                                                   |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PDF generation | in-process                                                    | in a serverless function (fonts are inlined into the bundle, no file-system reads; large reports take a few seconds, well within limits) |
| File storage   | none needed — uploads are parsed in memory, PDFs are streamed | same                                                                                                                                     |
| Origin/CSRF    | set `ORIGIN` at build time or proxy headers                   | automatic                                                                                                                                |
| Rate limiting  | in-memory per process                                         | per function instance (weaker) — rely on Supabase Auth rate limits                                                                       |

## Email delivery

Optional. Set `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a domain verified in Resend) and
`REPORT_EMAIL_TO`. The Reports page then shows **Generate and email**.

- Each click carries an idempotency key (stored as unique in `report_records` and sent as
  Resend's `Idempotency-Key` header), so double-clicks or retries do not send twice.
- Every attempt is recorded (status, masked recipient, error text without secrets) and
  audited. A failed email never affects results; the PDF can always be downloaded, and
  **Send again** is available in the report history.
- Judges have no email addresses; all requests and notifications to judges are shown inside
  the app.

## PDF reports and Tamil fonts

Reports are generated with `pdfkit` using **Noto Sans** and **Noto Sans Tamil** (SIL Open Font
License, `src/lib/server/fonts/OFL.txt`). The fonts are inlined into the server bundle at
build time and embedded (subset) into each PDF, so viewers need no Tamil fonts installed.

- Text is split into script runs: Tamil runs use Noto Sans Tamil, other text uses Noto Sans
  (neither font covers both scripts).
- Tamil shaping is done by `fontkit`'s Indic shaper. This was checked visually (prefix vowel
  signs such as கே, split vowels such as கொ, the ஸ்ரீ and க்ஷ conjuncts, pulli) and is
  asserted in `pdf.test.ts`.
- The **final** report contains only events with an active finalization snapshot; other
  events are listed as “Not finalized – results pending” without any marks. The **progress**
  report is stamped “NOT FINAL” and shows submission counts only.
- Options: report language (labels only — names and criteria are printed exactly as entered),
  and per-judge totals plus a criterion-by-criterion breakdown.

To inspect a PDF's rendering yourself (optional, needs Python with PyMuPDF):
`python -c "import pymupdf; d=pymupdf.open('report.pdf'); d[0].get_pixmap(dpi=110).save('p1.png')"`.

## Running an event

**Before the day**

1. Settings: application title, default language, username/password patterns.
2. Groups and events (short codes). For each event: criteria and maximum marks, decimal
   places allowed, judge instructions.
3. Participants: add manually or import CSV/XLSX (Participants → Import; download the
   template). The preview shows row-level problems and an error report; nothing is saved
   until you confirm, and a file with any error imports nothing.
4. Judges: create accounts (optionally assigning the event at the same time) and check
   Assignments. Give each judge their username and password.

**During judging**

- Dashboard shows, live, how many judges have submitted per event, what is in progress,
  pending requests, and which events are complete. Filter by group, event or judge.
- Submissions → open one to see marks, correct a mark (reason required), reopen, or send a
  correction request (optionally unlocking the submission).
- Requests: approve or reject reopening requests; resolve or cancel correction requests.

**Results**

- Results → event: rankings appear only after every required judge has submitted complete
  marks. Ties are flagged; assign ranks explicitly with a reason (equal ranks are allowed
  if you decide on a shared place), optionally linking related correction requests, or ask
  judges to review first.
- Finalize to freeze the ranking for reports. Any later correction, reopening or relevant
  configuration change automatically invalidates the finalization (audited) and you
  finalize again.
- Reports: preview, download, or email the PDF.

**Changing things after scoring has started**
Changing a criterion's maximum or active state, adding/removing judges or participants,
deactivating an event, or changing decimal places requires a reason, is audited, and
invalidates any finalization. Changes that would make existing marks invalid (for example a
maximum below an existing mark) are refused. Deleting events, criteria or assignments that
already have marks is impossible.

## Backup and recovery

- **Supabase backups:** paid plans include daily backups and point-in-time recovery; on the
  free plan, take your own backups. Before and after the event:
  ```bash
  npx supabase db dump --linked -f backup-schema.sql
  npx supabase db dump --linked --data-only -f backup-data.sql
  ```
  Store dumps securely: they contain participant names and marks.
- **Restore:** create a fresh project, `npx supabase db push`, then load the data dump with
  `psql` (the connection string is in Project Settings → Database). Auth users live in the
  `auth` schema; include it in your dump strategy (`supabase db dump` with
  `--schema auth` as well), or recreate judge accounts and reset passwords.
- **Exports during the event:** participant lists (CSV/XLSX) and PDF reports are useful
  offline copies. Final results are also preserved as snapshots in `result_finalizations`.
- **History is never deleted:** previous marks (`score_history`), each submission round
  (`submission_rounds`) and every state change (`submission_transitions`) remain available.
- **Judges' devices:** unsent marks stay in the browser (IndexedDB) until confirmed by the
  server; a judge should not clear site data while the status shows unsaved changes.

## Troubleshooting

| Symptom                                                                    | Cause / fix                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server stops at start with “Invalid environment variables”                 | A required variable is missing or malformed; the message names it.                                                                                            |
| Login always fails with a correct password                                 | `AUTH_EMAIL_DOMAIN` differs from the one used when the account was created, or the Email provider is disabled in Supabase.                                    |
| Login says “Too many attempts”                                             | 8 failed attempts per username in 5 minutes; wait, or have an admin set a new password. Many judges at once: raise Supabase's sign-in rate limit (see setup). |
| Every form says “Cross-site POST form submissions are forbidden”           | Node deployment without `ORIGIN` (build time) or proxy headers.                                                                                               |
| “Signups not allowed” when creating judges                                 | Expected for self-signup; admin creation uses the secret key — check `SUPABASE_SERVICE_ROLE_KEY` is the **secret** key.                                       |
| Dashboard shows “Refreshing every 30 seconds” instead of “Live updates on” | Realtime could not connect (network/proxy blocks WebSockets); the page still refreshes by polling.                                                            |
| Judge sees “Offline – marks are kept on this device”                       | No connection; marks are safe locally and sync automatically. “Try again now” forces a retry.                                                                 |
| Judge sees a “mark was changed elsewhere” message                          | The same submission was edited on another device; choose which value to keep.                                                                                 |
| “Scoring has started. Please confirm with a reason.”                       | Enter a reason; the change is audited.                                                                                                                        |
| Result page says results are hidden                                        | Not every assigned, active judge has submitted complete marks (see the judges list on that page).                                                             |
| Tamil shows as boxes in the browser                                        | The device lacks a Tamil font (rare on phones); install Noto Sans Tamil. PDFs embed their own fonts.                                                          |
| `npm run check` says `$app/tsconfig` not found                             | Run `npx svelte-kit sync` (re-generated after `npm install`).                                                                                                 |
| Integration tests fail to connect                                          | Start Docker and `npm run db:start`; `.env` must point to `http://127.0.0.1:54321`.                                                                           |

## Reference project notes

The reference repository (`Tejeswar-16/dlbts-2025`, Next.js + Firebase) was inspected for
workflow ideas. What was reused conceptually: group/event structure with short codes
encoded in judge usernames (`judge` + number + group code + event code), per-event criteria,
summing all judges' totals for the leaderboard, and showing a participant's unit
(“samithi”, here a generic _Unit / affiliation_ field) in results.

Deliberate differences:

- After login, judges go straight to their own events — no group/event picker.
- Group/event/judge mappings, criteria and locks are data in the database, not hardcoded
  maps in front-end code; permissions are enforced by RLS and database functions rather than
  client-side checks.
- Locking, totals, aggregation, ranking and ties are computed and enforced in the database;
  ties are never broken by order.
- Results are produced as PDF (with Tamil support) rather than the reference's PowerPoint
  template. The provided `DLBTS-2025-template.pptx` was not used.
- No phone numbers or personal data beyond names, codes, unit, optional registration number
  and notes are collected.

## Known limitations

- Hosted Supabase, a real Resend send, and an actual Vercel deployment were **not** exercised
  here (no credentials); the Vercel build and all code paths were tested locally, email with
  a mocked provider.
- The login rate limiter is in-memory per server instance.
- Offline support covers network loss while the scoring page is open and recovery after a
  refresh when the server is reachable; pages cannot be opened for the first time while
  fully offline (no service worker).
- Reports render all events in one PDF; very large competitions produce long documents.
