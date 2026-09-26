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

/** Toggles applied state across every profile of this user matched to this job. Returns the new state. */
export async function toggleJobApplied(userId: string, jobPostingId: string): Promise<boolean> {
  const matches = await db.matchScore.findMany({
    where: { jobPostingId, profile: { userId } },
    select: { id: true, appliedAt: true },
  });
  if (matches.length === 0) {
    throw new Error("No match found for this job under your search profiles.");
  }

  const currentlyApplied = matches.some((m) => m.appliedAt !== null);
  const nextAppliedAt = currentlyApplied ? null : new Date();

  await db.matchScore.updateMany({
    where: { id: { in: matches.map((m) => m.id) } },
    data: { appliedAt: nextAppliedAt },
  });

  if (!currentlyApplied) {
    await recordActivity(userId, "JOB_APPLIED", { jobPostingId });
  }

  return !currentlyApplied;
}
