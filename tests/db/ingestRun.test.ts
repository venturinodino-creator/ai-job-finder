import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { runIngest } from "@/agents/ingest";
import type { JobSourceAdapter, NormalizedJobPosting } from "@/agents/sources";
import { resetDatabase } from "../support/seed";

// Embeddings call out to OpenAI; ingestion must work without them.
vi.mock("@/lib/embeddings", () => ({ embedBatch: async (texts: string[]) => texts.map(() => []) }));

// The daily cron has five minutes. With a couple of hundred sources it cannot
// always finish them all, so each run starts with the sources that have waited
// longest, stops starting new ones once its time budget is spent, and leaves
// the rest untouched for tomorrow's run.

const posting = (id: string): NormalizedJobPosting => ({
  externalId: id,
  title: `Role ${id}`,
  company: "Acme",
  location: null,
  remoteType: "REMOTE",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  industries: [],
  description: "A role at Acme.",
  url: `https://example.test/${id}`,
  postedAt: null,
});

function adapter(key: string, fetch: () => Promise<NormalizedJobPosting[]> = async () => [posting(key)]): JobSourceAdapter {
  return { key, name: key, baseUrl: `https://example.test/${key}`, fetch };
}

async function seedFetched(key: string, lastFetchedAt: Date | null) {
  await db.jobSource.create({ data: { key, name: key, kind: "PUBLIC_API", baseUrl: "https://example.test", lastFetchedAt } });
}

describe("ingest run", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("starts with the sources that have never been fetched, then the ones fetched longest ago", async () => {
    await seedFetched("recent", new Date("2026-10-02T05:00:00Z"));
    await seedFetched("old", new Date("2026-09-20T05:00:00Z"));
    const started: string[] = [];
    const record = (key: string) => async () => {
      started.push(key);
      return [posting(key)];
    };

    const summaries = await runIngest([adapter("recent", record("recent")), adapter("brand-new", record("brand-new")), adapter("old", record("old"))]);

    expect(summaries.map((s) => s.source)).toEqual(["brand-new", "old", "recent"]);
    expect(started.sort()).toEqual(["brand-new", "old", "recent"]);
  });

  it("stops starting sources once the time budget is spent and leaves those untouched", async () => {
    let clock = 0;
    const slow = (key: string) =>
      adapter(key, async () => {
        clock += 1000; // each fetch "takes" a second
        return [posting(key)];
      });
    const adapters = ["a", "b", "c", "d", "e", "f"].map(slow);

    const summaries = await runIngest(adapters, { budgetMs: 500, now: () => clock });

    const deferred = summaries.filter((s) => s.deferred);
    const processed = summaries.filter((s) => !s.deferred);
    expect(processed.length).toBeGreaterThan(0);
    expect(deferred.length).toBeGreaterThan(0);
    expect(processed.length + deferred.length).toBe(6);

    // A deferred source was not fetched, so it keeps its place at the front of the queue.
    for (const d of deferred) {
      expect(d).toMatchObject({ fetched: 0, created: 0, existing: 0 });
      const row = await db.jobSource.findUnique({ where: { key: d.source } });
      expect(row?.lastFetchedAt ?? null).toBeNull();
    }
    for (const p of processed) {
      const row = await db.jobSource.findUnique({ where: { key: p.source } });
      expect(row?.lastFetchedAt).not.toBeNull();
    }
  });

  it("runs everything when no budget is given", async () => {
    const adapters = ["a", "b", "c", "d", "e", "f"].map((k) => adapter(k));

    const summaries = await runIngest(adapters);

    expect(summaries.every((s) => !s.deferred && s.created === 1)).toBe(true);
    expect(await db.jobPosting.count()).toBe(6);
  });

  it("gives up on a source that never answers, records why, and carries on with the rest", async () => {
    const hung = adapter("hung", () => new Promise<NormalizedJobPosting[]>(() => {}));

    const summaries = await runIngest([hung, adapter("fine")], { fetchTimeoutMs: 25 });

    const byKey = Object.fromEntries(summaries.map((s) => [s.source, s]));
    expect(byKey.hung.error).toMatch(/timed out/i);
    expect(byKey.fine.created).toBe(1);
    const row = await db.jobSource.findUnique({ where: { key: "hung" } });
    expect(row?.lastError).toMatch(/timed out/i);
    expect(row?.lastFetchedAt).toBeNull();
  });
});
