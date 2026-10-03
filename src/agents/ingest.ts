import { db } from "@/lib/db";
import { embedBatch } from "@/lib/embeddings";
import { jobSourceAdapters } from "./sources";
import type { JobSourceAdapter, NormalizedJobPosting } from "./sources";

export interface IngestSummary {
  source: string;
  fetched: number;
  created: number;
  /** Already in the DB from an earlier run; left untouched. */
  existing: number;
  error?: string;
  /** Not started: the run's time budget was spent first. It goes to the front of the next run. */
  deferred?: boolean;
}

export interface IngestOptions {
  /**
   * Stop starting new sources this many milliseconds after the run begins.
   * Sources already running finish. Unset means no limit (the worker process).
   */
  budgetMs?: number;
  /** Gives up on a source whose fetch has not answered by then. Defaults to a minute. */
  fetchTimeoutMs?: number;
  /** Clock for the budget; tests pass a fake one. */
  now?: () => number;
}

// Sources are independent, so a few fetch/embed/insert pipelines run side by
// side. Kept modest: the embedding API and the Postgres pool are shared.
const SOURCE_CONCURRENCY = 4;
const INSERT_CHUNK_SIZE = 100;
const DEFAULT_FETCH_TIMEOUT_MS = 60_000;

/**
 * Runs every configured job-source adapter, inserts postings that are new by
 * (sourceId, externalId), and embeds only those. Postings we already hold are
 * left as they are — descriptions rarely change, and with 200+ sources a
 * per-row upsert of everything would blow the cron's time budget.
 *
 * Sources are taken stalest-first (never fetched, then longest ago), and with a
 * `budgetMs` the run stops starting new ones once it is spent, so a cron that
 * cannot fit every source still gets through all of them over a few days.
 * Intended to run once a day (see src/worker/index.ts, vercel.json).
 */
export async function runIngest(
  adapters: JobSourceAdapter[] = jobSourceAdapters,
  options: IngestOptions = {},
): Promise<IngestSummary[]> {
  const now = options.now ?? Date.now;
  const deadline = options.budgetMs === undefined ? Infinity : now() + options.budgetMs;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  const queue = await stalestFirst(adapters);
  const summaries: IngestSummary[] = new Array(queue.length);
  let next = 0;

  async function worker() {
    while (next < queue.length) {
      const i = next++;
      summaries[i] =
        now() >= deadline
          ? { source: queue[i].key, fetched: 0, created: 0, existing: 0, deferred: true }
          : await ingestOne(queue[i], fetchTimeoutMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(SOURCE_CONCURRENCY, queue.length) }, worker));
  return summaries;
}

/** Never-fetched sources first, then by how long ago they were last fetched; ties keep their configured order. */
async function stalestFirst(adapters: JobSourceAdapter[]): Promise<JobSourceAdapter[]> {
  const rows = await db.jobSource.findMany({
    where: { key: { in: adapters.map((a) => a.key) } },
    select: { key: true, lastFetchedAt: true },
  });
  const fetchedAt = new Map(rows.map((r: { key: string; lastFetchedAt: Date | null }) => [r.key, r.lastFetchedAt?.getTime() ?? 0]));
  return adapters
    .map((adapter, index) => ({ adapter, index, at: fetchedAt.get(adapter.key) ?? 0 }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((entry) => entry.adapter);
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000) || ms / 1000}s`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function ingestOne(adapter: JobSourceAdapter, fetchTimeoutMs: number): Promise<IngestSummary> {
  const source = await db.jobSource.upsert({
    where: { key: adapter.key },
    create: { key: adapter.key, name: adapter.name, baseUrl: adapter.baseUrl, kind: adapter.kind ?? "PUBLIC_API" },
    update: { name: adapter.name, baseUrl: adapter.baseUrl, kind: adapter.kind ?? "PUBLIC_API" },
  });

  let postings: NormalizedJobPosting[];
  try {
    postings = await withTimeout(adapter.fetch(), fetchTimeoutMs, adapter.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.jobSource.update({ where: { id: source.id }, data: { lastError: message } });
    return { source: adapter.key, fetched: 0, created: 0, existing: 0, error: message };
  }

  // A feed can repeat an id (e.g. the same posting under two locations); keep the first.
  const unique = new Map<string, NormalizedJobPosting>();
  for (const p of postings) if (!unique.has(p.externalId)) unique.set(p.externalId, p);
  postings = Array.from(unique.values());

  const existing = await db.jobPosting.findMany({
    where: { sourceId: source.id, externalId: { in: postings.map((p) => p.externalId) } },
    select: { externalId: true },
  });
  const existingIds = new Set(existing.map((e: { externalId: string }) => e.externalId));
  const newPostings = postings.filter((p) => !existingIds.has(p.externalId));

  const embeddings = await safeEmbedBatch(newPostings.map(descriptionForEmbedding));

  let created = 0;
  for (let i = 0; i < newPostings.length; i += INSERT_CHUNK_SIZE) {
    const chunk = newPostings.slice(i, i + INSERT_CHUNK_SIZE);
    const result = await db.jobPosting.createMany({
      skipDuplicates: true,
      data: chunk.map((posting, j) => ({
        sourceId: source.id,
        externalId: posting.externalId,
        title: posting.title,
        company: posting.company,
        location: posting.location,
        remoteType: posting.remoteType,
        salaryMin: posting.salaryMin,
        salaryMax: posting.salaryMax,
        salaryCurrency: posting.salaryCurrency,
        industries: posting.industries,
        description: posting.description,
        url: posting.url,
        applyEmail: extractApplyEmail(posting.description),
        postedAt: posting.postedAt,
        embedding: embeddings[i + j] ?? [],
      })),
    });
    created += result.count;
  }

  await db.jobSource.update({
    where: { id: source.id },
    data: { lastFetchedAt: new Date(), lastError: null },
  });

  return { source: adapter.key, fetched: postings.length, created, existing: existingIds.size };
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const NOT_FOR_APPLYING = /^(no-?reply|privacy|support|press|unsubscribe|dpo|legal|security|abuse|billing|help|newsletter)/i;

/**
 * Finds an address a candidate could apply to. Most boards only give a URL,
 * but some postings say "send your CV to jobs@…" — those are the ones the
 * in-app email apply can use. Prefers an address that sits near apply-ish
 * wording; skips obvious non-recruiting mailboxes.
 */
export function extractApplyEmail(description: string): string | null {
  const lower = description.toLowerCase();
  const candidates = Array.from(new Set((description.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))).filter(
    (e) => !NOT_FOR_APPLYING.test(e),
  );
  for (const email of candidates) {
    const at = lower.indexOf(email);
    const context = lower.slice(Math.max(0, at - 160), at + email.length + 40);
    if (/apply|application|send|cv|resume|candidat|recruit|career|jobs?@/.test(context)) return email;
  }
  return candidates[0] ?? null;
}

function descriptionForEmbedding(posting: NormalizedJobPosting): string {
  return `${posting.title} at ${posting.company}. ${posting.industries.join(", ")}. ${posting.description}`;
}

/** Embedding calls need an API key; ingestion should still succeed without one. */
async function safeEmbedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    return await embedBatch(texts);
  } catch (err) {
    console.warn("Skipping embeddings for this ingest run:", err instanceof Error ? err.message : err);
    return texts.map(() => []);
  }
}
