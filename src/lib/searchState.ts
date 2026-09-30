import { db } from "@/lib/db";
import type { Cv, JobPosting, JobSource, MatchScore, SearchProfile } from "@/generated/prisma/client";

/** A scored role is a "strong match" from this score up; below it, it's shown but not led with. */
export const STRONG_MATCH_MIN = 60;
/** The score distribution is drawn in ten-point buckets, 0–9 … 90–100. */
export const DISTRIBUTION_BUCKETS = 10;

export type MatchWithJob = MatchScore & { jobPosting: JobPosting & { source: JobSource } };

export type { PipelineCounts, PipelineStage } from "@/lib/pipelineStages";
export { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, parseStage } from "@/lib/pipelineStages";
import type { PipelineCounts, PipelineStage } from "@/lib/pipelineStages";

export interface SearchState {
  profile: SearchProfile | null;
  activeCv: Cv | null;
  /** The stage the matches are narrowed to, or null for the whole search. */
  stage: PipelineStage | null;
  /** The current search's matches grouped as the feed shows them, narrowed to `stage` when one is set. */
  matches: { strong: MatchWithJob[]; wildcards: MatchWithJob[]; other: MatchWithJob[] };
  /** Counts for the whole search, whatever the stage filter. */
  pipeline: PipelineCounts;
  /** Non-wildcard scores per ten-point bucket. */
  distribution: number[];
  /** When the most recent match row of the current search was scored. */
  lastScoredAt: Date | null;
}

const EMPTY_PIPELINE: PipelineCounts = { scored: 0, strong: 0, opened: 0, prepared: 0, applied: 0 };

/**
 * The state of one user's search: the active profile and CV, the current
 * search's matches grouped the way the feed shows them, and the counts the
 * Overview reads. "Current search" is the set of match rows belonging to the
 * active profile; changing the profile already clears the rows the user
 * hasn't acted on, so nothing here needs to know when the search changed.
 *
 * With a `stage`, the matches are narrowed to the rows behind that step of
 * the pipeline, so a list built from them has exactly the step's count. The
 * pipeline counts and the distribution always describe the whole search.
 */
export async function searchState(userId: string, options: { stage?: PipelineStage | null } = {}): Promise<SearchState> {
  const stage = options.stage ?? null;
  const profile = await db.searchProfile.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    include: { activeCv: true },
  });
  if (!profile) {
    return { profile: null, activeCv: null, stage, matches: { strong: [], wildcards: [], other: [] }, pipeline: { ...EMPTY_PIPELINE }, distribution: emptyDistribution(), lastScoredAt: null };
  }
  const { activeCv, ...profileRow } = profile;

  const rows = await db.matchScore.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isWildcard: "asc" }, { score: "desc" }],
    include: { jobPosting: { include: { source: true } } },
  });
  const postingIds = rows.map((m) => m.jobPostingId);
  const [applications, tailored] = await Promise.all([
    db.application.findMany({ where: { userId, jobPostingId: { in: postingIds } }, select: { jobPostingId: true, status: true } }),
    db.tailoredCv.findMany({ where: { jobPostingId: { in: postingIds }, cv: { userId } }, select: { jobPostingId: true } }),
  ]);

  // The pipeline is a funnel: acting on a posting implies the stages before
  // it, so a role marked applied straight from a list still counts as opened
  // and prepared, and a later stage can never exceed an earlier one.
  const applicationsByPosting = new Map(applications.map((a) => [a.jobPostingId, a.status]));
  const tailoredPostings = new Set(tailored.map((t) => t.jobPostingId));
  const isStrong = (m: MatchScore) => !m.isWildcard && m.score >= STRONG_MATCH_MIN;
  const isApplied = (m: MatchScore) => {
    const status = applicationsByPosting.get(m.jobPostingId);
    return m.appliedAt !== null || status === "SENT" || status === "APPLIED";
  };
  const isPrepared = (m: MatchScore) => isApplied(m) || tailoredPostings.has(m.jobPostingId) || applicationsByPosting.has(m.jobPostingId);
  const isOpened = (m: MatchScore) => isPrepared(m) || m.viewedAt !== null;
  const inStage: Record<PipelineStage, (m: MatchScore) => boolean> = {
    scored: () => true,
    strong: isStrong,
    opened: isOpened,
    prepared: isPrepared,
    applied: isApplied,
  };

  const main = rows.filter((m) => !m.isWildcard);
  const pipeline: PipelineCounts = {
    scored: rows.length,
    strong: main.filter(isStrong).length,
    opened: rows.filter(isOpened).length,
    prepared: rows.filter(isPrepared).length,
    applied: rows.filter(isApplied).length,
  };

  const shown = stage ? rows.filter(inStage[stage]) : rows;
  const shownMain = shown.filter((m) => !m.isWildcard);
  const matches = {
    strong: shownMain.filter((m) => m.score >= STRONG_MATCH_MIN),
    other: shownMain.filter((m) => m.score < STRONG_MATCH_MIN),
    wildcards: shown.filter((m) => m.isWildcard),
  };

  const distribution = emptyDistribution();
  for (const m of main) distribution[Math.min(DISTRIBUTION_BUCKETS - 1, Math.floor(m.score / 10))] += 1;
  const lastScoredAt = rows.reduce<Date | null>((latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest), null);

  return { profile: profileRow, activeCv, stage, matches, pipeline, distribution, lastScoredAt };
}

function emptyDistribution(): number[] {
  return Array.from({ length: DISTRIBUTION_BUCKETS }, () => 0);
}
