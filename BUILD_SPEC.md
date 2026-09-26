# AI Job Finder — Build Spec

An open-source, self-hostable tool that: (1) searches the job market for you every day, (2) ranks every match
0–100% against your CV and preferences with a plain-English reason, and (3) reviews and tailors your CV so each
application has the best shot. This document is the architecture reference; `README.md` is the quickstart.

## 1. Goals & non-goals

- **Goal:** set up a search profile + CV once, get a ranked daily feed, and get CV coaching, in minutes, on your
  own infrastructure or a small VPS.
- **Non-goal (v1):** a job-board-scale crawler. We integrate with a handful of free/open job APIs and are
  designed so adding a new source is a single small file (see §4).
- **Non-goal (v1):** multi-tenant SaaS billing, teams, or admin dashboards. Single-tenant per deployment,
  multi-user within a deployment (each user has their own profiles/CVs/matches).

## 2. Tech stack

| Layer            | Choice                                            | Why |
|-------------------|----------------------------------------------------|-----|
| App framework     | Next.js 16 (App Router, TypeScript)                | One codebase for UI + API routes; runs anywhere Node runs (self-host, Docker, or any Node host). |
| Database          | PostgreSQL + Prisma ORM                            | Relational fit for users/profiles/postings/matches; Prisma migrations are the easiest onboarding for contributors. |
| LLM               | Vercel AI SDK (`ai`) with pluggable provider       | `LLM_PROVIDER=anthropic\|openai` in `.env` swaps the model with zero code changes. Anthropic (Claude) is the default. |
| Embeddings        | OpenAI `text-embedding-3-small` (pluggable, optional) | Cheap cosine-similarity pre-filter before the LLM scores/explains the shortlist. Anthropic has no embeddings endpoint, so this is skippable — every agent that embeds falls back gracefully (ingest stores postings without vectors, matching scores the most recent postings directly) when no embeddings key is set. |
| Auth              | Cookie session + JWT, bcrypt password hashing      | No external auth dependency required for a self-hosted single-file deploy. Swap for NextAuth/Clerk if you want SSO. |
| File storage      | Pluggable adapter: local disk (default), Vercel Blob, or S3-compatible (stub) | Self-host works out of the box. `vercel-blob` stores CVs as private blobs for Vercel, where functions have no persistent disk. S3/R2 is still a TODO (§9). All adapters serve files through the same authenticated `/api/files/[...key]` route, so the ownership check lives in one place. |
| Background jobs   | `node-cron` worker process (`npm run worker`), or HTTP cron endpoints (`/api/cron/*`) | Works with just `docker compose up`; `vercel.json` ships the same schedule as Vercel Cron for the hosted path. Both call the identical agent functions. |
| Email digest      | Resend (optional)                                  | Digests always generate in-app; email is a nice-to-have that degrades gracefully without an API key. |
| Deployment        | Docker Compose (self-host) or Vercel (Neon Postgres + Blob + Cron) | `Dockerfile` + `docker-compose.yml` for self-hosting; `vercel-build` runs migrations on every Vercel deploy. No platform lock-in — it's a standard Next.js + Postgres app either way. |

## 3. Data model

Full source of truth: [`prisma/schema.prisma`](prisma/schema.prisma). Summary of the entities and why each exists:

- **User** — one account per person. `digestHour`/`timezone` reserved for per-user digest send times.
- **SearchProfile** — what to search for: `targetRoles`, `locations`, `remotePref`, `seniority`, salary range,
  `industries`, `languages`, plus `activeCvId` (which uploaded CV to score against). A user can have multiple
  profiles (e.g. "EU remote backend" vs "US on-site staff"); each is scored independently.
- **Cv** — the uploaded file (via the storage adapter) + `rawText` (extracted) + `parsed` (structured JSON:
  skills, experience, education) + `embedding` (vector for similarity matching). Versioned so re-uploads don't
  destroy history.
- **CvReview / CvIssue** — the "is this CV strong?" verdict, score, strengths, and a list of categorized,
  actionable issues (`MISSING_KEYWORDS`, `WEAK_BULLET`, `STRUCTURE`, `FORMATTING`, `ATS_COMPATIBILITY`,
  `QUANTIFICATION`) each with a severity and a concrete suggestion.
- **TailoredCv** — per-job-posting tailoring suggestions (before/after edits + reasons) for one CV. Unique per
  `(cvId, jobPostingId)` so re-tailoring just updates the existing row.
- **JobSource** — one row per adapter (Remotive, Arbeitnow, RemoteOK, ...), tracking last successful fetch and
  last error so a broken source doesn't silently starve the feed.
- **JobPosting** — a normalized posting: `(sourceId, externalId)` is unique (dedup key), plus `embedding` for
  the similarity pre-filter and `postedAt` for freshness windows.
- **MatchScore** — one row per `(profile, jobPosting)`: `score` (0–100), `explanation`, `matchedSkills` /
  `missingSkills`, and `isWildcard` + `wildcardReason` for surprise picks. This is what both the API and the
  daily digest read from — it's the "already computed" cache, so viewing the feed never re-runs the LLM.
- **DailyDigest / DailyDigestEntry** — one digest per `(user, date)`, with ranked entries pointing at
  `MatchScore` rows. Keeps a durable history of "what did we show this person, and when."

### Why embeddings *and* an LLM for matching?

Embeddings alone can't produce a trustworthy 0–100 score or a human explanation, and calling an LLM on every job
in the DB against every profile doesn't scale. So: embeddings do a cheap top-N pre-filter (cosine similarity
between the profile/CV text and the job description), and the LLM only scores that shortlist — producing the
score, explanation, matched/missing skills, and wildcard flag in one structured call per profile per run (see
`src/agents/match.ts`).

## 4. Job sources

v1 ships three free, no-key-required public APIs (see `src/agents/sources/`):

| Source    | Kind        | Notes |
|-----------|-------------|-------|
| Remotive  | Public API  | Remote-only listings. API asks for ≤4 requests/day and a link back to the posting — our daily ingest respects both. |
| Arbeitnow | Public API  | EU-heavy job board, mixed remote/on-site. |
| RemoteOK  | Public API  | Remote-only; requires a browser-like `User-Agent` header. Asks for attribution back to the posting. |

**Adding a source** means implementing the `JobSourceAdapter` interface in `src/agents/sources/types.ts`
(`key`, `name`, `baseUrl`, `fetch(): Promise<NormalizedJobPosting[]>`) and registering it in
`src/agents/sources/index.ts`. Natural next additions:

- **Company job boards** (Greenhouse, Lever, Ashby) — each exposes a public JSON API per company
  (e.g. `boards-api.greenhouse.io/v1/boards/<company>/jobs`); one adapter per configured company slug list.
- **Adzuna / USAJobs / Jooble** — free tiers, but require an API key; wire the key through `.env` and gate the
  adapter on its presence so a fresh install doesn't error out.
- **RSS-based boards** (We Work Remotely, etc.) — parse the feed into the same `NormalizedJobPosting` shape.

All sources respect the same contract, dedup on `(sourceId, externalId)`, and get embedded once on first ingest
(existing postings keep their embedding — descriptions rarely change).

## 5. Agent schedule

Two ways to run the agents; pick one per deployment:

1. **Standalone worker** (`npm run worker`, or the `worker` service in `docker-compose.yml`) — a long-running
   Node process using `node-cron`:
   - **05:00 UTC** — ingest: run every `JobSourceAdapter`, upsert new/updated postings, embed only new ones.
   - **06:30 UTC** — digest: for every user with an active profile, re-run matching (`src/agents/match.ts`)
     against the last 14 days of postings, persist `MatchScore` rows, compile + send today's `DailyDigest`.
   - Also runs both once immediately on boot, so a fresh self-host isn't empty until the next scheduled tick.
2. **Managed HTTP cron** — `/api/cron/ingest` and `/api/cron/digest` (GET or POST), both guarded by
   `Authorization: Bearer $CRON_SECRET`. `vercel.json` already declares the same two schedules for Vercel
   Cron, which sends that header on its own once `CRON_SECRET` is set as a project env var; a Kubernetes
   `CronJob` or GitHub Actions schedule can hit the same routes. Both routes set `maxDuration = 300` since a
   digest is one LLM call per active profile, run sequentially.

   One deployment gotcha for serverless Postgres (Neon, Supabase): `prisma migrate deploy` takes a
   session-level advisory lock, which PgBouncer's transaction pooling can't hold — run migrations against the
   provider's **unpooled** URL (`prisma.config.ts` prefers `DATABASE_URL_UNPOOLED` when present). If a deploy
   is interrupted mid-migration, the lock can be orphaned on a pooled backend and every later `migrate deploy`
   will time out; terminate the holder (`pg_locks` where `objid = 72707369`, then `pg_terminate_backend`).

On top of the schedule, two actions are user-triggered (no cron needed):

- **CV upload** (`POST /api/cv`) synchronously extracts text, asks the LLM to structure it, embeds it, and runs
  the CV review — the user sees a rated review immediately after upload.
- **"Refresh matches now"** (`POST /api/digest/run`, used by the job-feed page) re-runs matching + digest
  compilation for the current user only, so you don't have to wait for the nightly schedule while testing.
- **"Tailor my CV to this job"** (`POST /api/jobs/:id/tailor`) runs on demand, per job posting.

Both the worker and the HTTP-cron routes call the exact same agent functions (`src/agents/*.ts`) — there's no
duplicated logic between "how it runs on my laptop" and "how it runs on a managed platform."

## 6. Match scoring, in detail

For a given `SearchProfile` (see `src/agents/match.ts`):

1. Build a text blob from the profile's target roles/locations/remote-pref/seniority/salary/industries/languages
   plus the active CV's extracted text.
2. If an embeddings provider is configured, embed that blob and compare (cosine similarity) against the last 14
   days of `JobPosting` embeddings, taking the top 40 candidates. Without one (e.g. an Anthropic-only setup,
   since Anthropic has no embeddings endpoint), skip straight to the 40 most recently posted jobs instead.
3. One structured LLM call scores all 40 against the profile: `score` (0–100), one-line `explanation`,
   `matchedSkills`/`missingSkills`, and `isWildcard` (+ `wildcardReason` when true — the model is instructed to
   flag wildcards only for roles outside the exact target search that are still a genuinely strong skills fit).
4. Persist the top 15 non-wildcard matches and top 3 wildcards as `MatchScore` rows (upserted, so re-running
   today just refreses the numbers instead of duplicating rows).

## 7. CV review & tailoring, in detail

- **Parse** (`src/agents/cvParse.ts`): extract raw text (`pdf-parse` for PDF, `mammoth` for DOCX, plain read for
  `.txt`), ask the LLM to extract structured fields (skills, experience, education, languages) without
  inventing data, embed the result.
- **Review** (`src/agents/cvReview.ts`): LLM rates 0–100, gives a verdict (`STRONG`/`GOOD`/`NEEDS_WORK`/`WEAK`),
  strengths, ATS-compatibility notes, and a categorized, severity-ranked issue list with concrete suggestions
  (not generic advice — the model is instructed to quote actual CV text).
- **Tailor** (`src/agents/cvTailor.ts`): given one CV + one job posting, the LLM proposes section-level
  before/after edits and a rewritten summary — explicitly constrained to rephrasing/reordering existing content,
  never fabricating skills or achievements.

## 8. Security & privacy notes

- CVs are stored via a pluggable adapter (local disk by default); the local adapter guards against path
  traversal and files are served through an authenticated route (`/api/files/[...key]`) that checks the
  requesting user owns the key prefix — never served directly from disk.
- Sessions are httpOnly, `sameSite=lax` JWT cookies; passwords are hashed with bcrypt (cost 12).
- The `/api/cron/*` endpoints are only usable with `CRON_SECRET` (skip the check entirely if unset, e.g. local
  dev) — set it before exposing those routes publicly.
- CV/job text sent to the LLM/embeddings provider is subject to that provider's data-handling terms; self-hosters
  should pick a provider (and, for Anthropic/OpenAI, review zero-retention options) matching their compliance needs.

## 9. What's stubbed / next steps

- **S3 storage adapter** (`src/lib/storage.ts`) — interface is defined, implementation is a `TODO`; wire up
  `@aws-sdk/client-s3` (or R2/MinIO's S3-compatible SDK) if you need a non-Vercel multi-instance deploy. (The
  Vercel Blob adapter is implemented — use `STORAGE_DRIVER=vercel-blob` there.)
- **Per-user digest hour** — the `User.digestHour`/`timezone` columns exist but the worker currently runs one
  global schedule; grouping users by local send time is a natural v1.1.
- **Greenhouse/Lever company-board adapters** — see §4.
- **Queueing CV upload processing** — `POST /api/cv` currently parses+reviews inline (simple, but blocks the
  request for ~10–20s); move behind BullMQ/Vercel Queues/etc. if that becomes a problem.
