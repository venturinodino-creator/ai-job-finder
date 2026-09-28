import type { Prisma, SearchHistoryKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const KEEP_PER_USER = 50;

/**
 * Records a search in the archive. Repeating the most recent identical search
 * (same kind + params) just bumps its timestamp, so reloading a results page
 * or saving a profile twice doesn't pile up duplicates. Trims the archive to
 * the last KEEP_PER_USER entries.
 */
export async function recordSearch(
  userId: string,
  kind: SearchHistoryKind,
  label: string,
  params: Prisma.InputJsonValue,
): Promise<void> {
  const serialized = JSON.stringify(params);
  const latest = await db.searchHistory.findFirst({
    where: { userId, kind },
    orderBy: { updatedAt: "desc" },
  });
  if (latest && JSON.stringify(latest.params) === serialized) {
    await db.searchHistory.update({ where: { id: latest.id }, data: { label, updatedAt: new Date() } });
    return;
  }

  await db.searchHistory.create({ data: { userId, kind, label, params } });

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
