# AI Job Finder

Open-source, self-hostable job search agent: set up your search profile and CV once, get a ranked daily feed of
matches (plus a few wildcard surprises) with plain-English explanations, and get CV coaching before you apply.

See [`BUILD_SPEC.md`](BUILD_SPEC.md) for the full architecture: tech stack, data model, job sources, and agent
schedule.

## Quickstart (local dev)

Requires Node 20+ and Docker (for Postgres) — or point `DATABASE_URL` at any Postgres 14+ instance you already
have.

```bash
cp .env.example .env
# then edit .env: at minimum set JWT_SECRET, and ANTHROPIC_API_KEY (or OPENAI_API_KEY + LLM_PROVIDER=openai)
# for CV parsing/review/tailoring and match scoring. OPENAI_API_KEY is also
# required for embeddings regardless of LLM_PROVIDER (see .env.example).

docker compose up -d db          # Postgres on localhost:5432
npm install
npm run db:migrate               # create tables
npm run dev                      # http://localhost:3000
```

Register an account in the UI, set up a search profile, upload a CV, then either wait for the nightly agents or
click **"Refresh matches now"** on the job feed page to score immediately.

To run the background agents locally without the full worker process:

```bash
npm run ingest    # fetch + upsert postings from all job sources
npm run digest    # score + compile + (optionally) email today's digest for every user
```

## Running everything with Docker

```bash
cp .env.example .env   # edit as above
docker compose up -d --build
```

This starts Postgres, the Next.js app (`http://localhost:3000`, runs migrations on boot), and a `worker`
container running the daily ingest/digest schedule (`src/worker/index.ts`).

## Project layout

```
prisma/schema.prisma      Data model (see BUILD_SPEC.md §3)
src/agents/                The actual "AI" — ingest, match, cvParse, cvReview, cvTailor, digest
src/agents/sources/         One file per job source (Remotive, Arbeitnow, RemoteOK, ...)
src/lib/                    Shared infra: db, llm, embeddings, storage, auth
src/app/api/                Route handlers (auth, profile, cv, jobs, cron)
src/app/(dashboard pages)   The UI
src/worker/                 node-cron scheduler + one-off CLI runner
```

## Configuration

Every environment variable is documented in [`.env.example`](.env.example). Notable ones:

- `LLM_PROVIDER` (`anthropic` | `openai`) + `LLM_MODEL` — swap providers without touching code.
- `STORAGE_DRIVER` (`local` | `s3`) — CV files on local disk by default; see BUILD_SPEC.md §9 for wiring up S3.
- `RESEND_API_KEY` — optional; digests always generate in-app, email is a bonus.
- `CRON_SECRET` — required if you drive ingestion/digests via `/api/cron/*` instead of `npm run worker`.

## Known dev-dependency advisories

`npm audit` currently reports a few high-severity advisories under Prisma's own CLI dev-tooling
(`@prisma/config`'s optional `mysql2`/`deepmerge-ts` chain, unrelated to our Postgres-only runtime). They're not
reachable from anything this app runs; re-check with `npm audit` after bumping `prisma`/`@prisma/client`.

## License

MIT — see [`LICENSE`](LICENSE).
