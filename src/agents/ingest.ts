import { db } from "@/lib/db";
import { embedBatch } from "@/lib/embeddings";
import { jobSourceAdapters } from "./sources";
import type { JobSourceAdapter, NormalizedJobPosting } from "./sources";

export interface IngestSummary {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  error?: string;
}

/**
 * Runs every configured job-source adapter, upserts postings by
 * (sourceId, externalId), and embeds only the postings that are brand new
 * (existing postings keep their embedding — descriptions rarely change).
 * Intended to run once a day (see src/worker/index.ts).
 */
export async function runIngest(): Promise<IngestSummary[]> {
  const summaries: IngestSummary[] = [];

  for (const adapter of jobSourceAdapters) {
    const summary = await ingestOne(adapter);
    summaries.push(summary);
  }

  return summaries;
}

async function ingestOne(adapter: JobSourceAdapter): Promise<IngestSummary> {
  const source = await db.jobSource.upsert({
    where: { key: adapter.key },
    create: { key: adapter.key, name: adapter.name, baseUrl: adapter.baseUrl, kind: "PUBLIC_API" },
    update: { name: adapter.name, baseUrl: adapter.baseUrl },
  });

  let postings: NormalizedJobPosting[];
  try {
    postings = await adapter.fetch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.jobSource.update({ where: { id: source.id }, data: { lastError: message } });
    return { source: adapter.key, fetched: 0, created: 0, updated: 0, error: message };
  }

  const existing = await db.jobPosting.findMany({
    where: { sourceId: source.id, externalId: { in: postings.map((p) => p.externalId) } },
    select: { externalId: true },
  });
  const existingIds = new Set(existing.map((e: { externalId: string }) => e.externalId));
  const newPostings = postings.filter((p) => !existingIds.has(p.externalId));

  const embeddings = await safeEmbedBatch(newPostings.map(descriptionForEmbedding));

  let created = 0;
  let updated = 0;

  for (let i = 0; i < postings.length; i++) {
    const posting = postings[i];
    const isNew = !existingIds.has(posting.externalId);
    const embedding = isNew ? embeddings[newPostings.indexOf(posting)] : undefined;

    await db.jobPosting.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: posting.externalId } },
      create: {
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
        postedAt: posting.postedAt,
        embedding: embedding ?? [],
      },
      update: {
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
      },
    });

    if (isNew) created++;
    else updated++;
  }

  await db.jobSource.update({
    where: { id: source.id },
    data: { lastFetchedAt: new Date(), lastError: null },
  });

  return { source: adapter.key, fetched: postings.length, created, updated };
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
