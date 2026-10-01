import { db } from "@/lib/db";
import { recordActivity } from "@/lib/gamification";

/** Marks a job as viewed (idempotent) across every profile of this user matched to it. */
export async function markJobViewed(userId: string, jobPostingId: string): Promise<void> {
  const unviewed = await db.matchScore.findMany({
    where: { jobPostingId, profile: { userId }, viewedAt: null },
    select: { id: true },
  });
  if (unviewed.length === 0) return;

  await db.matchScore.updateMany({
    where: { id: { in: unviewed.map((m) => m.id) } },
    data: { viewedAt: new Date() },
  });
  await recordActivity(userId, "JOB_VIEWED", { jobPostingId });
}
