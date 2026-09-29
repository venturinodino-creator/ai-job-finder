import type { Prisma, SearchHistoryKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { ArchivedResult } from "@/lib/archivedResults";

const KEEP_PER_USER = 50;

/**
 * Records a search in the archive. Repeating an identical search (same kind +
 * params) — whether by reloading a results page, restoring an old profile
 * search, or re-running an entry from the archive card — bumps that entry to
 * the top (and refreshes its results) instead of adding a duplicate. Trims
 * the archive to the last KEEP_PER_USER entries.
 */
export async function recordSearch(
  userId: string,
  kind: SearchHistoryKind,
  label: string,
  params: Prisma.InputJsonValue,
  results?: ArchivedResult[],
): Promise<void> {
  const resultData = results
    ? { results: results as unknown as Prisma.InputJsonValue, resultCount: results.length }
    : {};

  const existing = await db.searchHistory.findFirst({
    where: { userId, kind, params: { equals: params } },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    await db.searchHistory.update({
      where: { id: existing.id },
      data: { label, updatedAt: new Date(), ...resultData },
    });
    return;
  }

  await db.searchHistory.create({ data: { userId, kind, label, params, ...resultData } });

  const overflow = await db.searchHistory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    skip: KEEP_PER_USER,
    select: { id: true },
  });
  if (overflow.length > 0) {
    await db.searchHistory.deleteMany({ where: { id: { in: overflow.map((o) => o.id) } } });
  }
}

export async function listRecentSearches(userId: string, take = 8) {
  return db.searchHistory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take });
}
