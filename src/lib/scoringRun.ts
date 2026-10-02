import { db } from "@/lib/db";

// A scoring run takes a minute or two and writes its scores only at the end,
// while a changed search drops the old scores at once. The search records
// when a run started, so every page can tell "scoring right now" from
// "nothing scored", and so a second run cannot start while one is in flight.

/**
 * How long a run may be in flight before it is presumed dead. The on-demand
 * run is allowed five minutes by the platform; a run that crashed without
 * releasing the search frees itself after this.
 */
export const SCORING_RUN_TIMEOUT_MS = 6 * 60_000;

/** Whether a run that started at `startedAt` is still counted as in flight. */
export function isScoringRunning(startedAt: Date | null, now = Date.now()): boolean {
  return startedAt !== null && now - startedAt.getTime() < SCORING_RUN_TIMEOUT_MS;
}

/**
 * Takes the search for a scoring run. True when this caller now owns the
 * run; false when another run is in flight. One atomic update, so two
 * simultaneous callers cannot both succeed.
 */
export async function claimScoringRun(profileId: string): Promise<boolean> {
  const now = new Date();
  const { count } = await db.searchProfile.updateMany({
    where: {
      id: profileId,
      OR: [{ scoringStartedAt: null }, { scoringStartedAt: { lt: new Date(now.getTime() - SCORING_RUN_TIMEOUT_MS) } }],
    },
    data: { scoringStartedAt: now },
  });
  return count === 1;
}

/** Gives the search back after a run, whether it finished or failed. */
export async function releaseScoringRun(profileId: string): Promise<void> {
  await db.searchProfile.updateMany({ where: { id: profileId }, data: { scoringStartedAt: null } });
}

/**
 * Runs `work` as the search's scoring run: claims it, always releases it
 * afterwards (a failure is passed on), and does nothing when another run is
 * already in flight.
 */
export async function withScoringRun<T>(profileId: string, work: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
  if (!(await claimScoringRun(profileId))) return { ran: false };
  try {
    return { ran: true, value: await work() };
  } finally {
    await releaseScoringRun(profileId);
  }
}
