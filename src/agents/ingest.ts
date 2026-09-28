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
}

// Sources are independent, so a few fetch/embed/insert pipelines run side by
// side. Kept modest: the embedding API and the Postgres pool are shared.
const SOURCE_CONCURRENCY = 4;
const INSERT_CHUNK_SIZE = 100;

/**
 * Runs every configured job-source adapter, inserts postings that are new by
 * (sourceId, externalId), and embeds only those. Postings we already hold are
 * left as they are — descriptions rarely change, and with ~30 sources a
 * per-row upsert of everything would blow the cron's time budget.
 * Intended to run once a day (see src/worker/index.ts, vercel.json).
 */
export async function runIngest(adapters: JobSourceAdapter[] = jobSourceAdapters): Promise<IngestSummary[]> {
  const summaries: IngestSummary[] = new Array(adapters.length);
  let next = 0;

  async function worker() {
    while (next < adapters.length) {
      const i = next++;
      summaries[i] = await ingestOne(adapters[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(SOURCE_CONCURRENCY, adapters.length) }, worker));
  return summaries;
}

async function ingestOne(adapter: JobSourceAdapter): Promise<IngestSummary> {
  const source = await db.jobSource.upsert({
    where: { key: adapter.key },
    create: { key: adapter.key, name: adapter.name, baseUrl: adapter.baseUrl, kind: adapter.kind ?? "PUBLIC_API" },
    update: { name: adapter.name, baseUrl: adapter.baseUrl, kind: adapter.kind ?? "PUBLIC_API" },
  });

  let postings: NormalizedJobPosting[];
  try {
    postings = await adapter.fetch();
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
