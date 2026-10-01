import { db } from "@/lib/db";
import { OUTSIDE_LOCATION_PENALTY } from "@/lib/locationFit";
import { stageHref } from "@/lib/pipelineStages";
import type { Cv, CvVerdict, JobPosting, JobSource, MatchScore, SearchProfile } from "@/generated/prisma/client";

import { STRONG_MATCH_MIN } from "@/lib/pipelineStages";
export { STRONG_MATCH_MIN };
/** The score distribution is drawn in ten-point buckets, 0–9 … 90–100. */
export const DISTRIBUTION_BUCKETS = 10;

export type MatchWithJob = MatchScore & { jobPosting: JobPosting & { source: JobSource } };

export type { PipelineCounts, PipelineStage } from "@/lib/pipelineStages";
export { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, parseStage } from "@/lib/pipelineStages";
import type { PipelineCounts, PipelineStage } from "@/lib/pipelineStages";

/** The six things the Overview can ask the user to attend to, most important first. */
export type AttentionFlagKind = "strong-unopened" | "drafts-unsent" | "cv-high-issues" | "new-postings" | "location-blocked" | "source-errors";
export const MAX_ATTENTION_FLAGS = 3;

export interface AttentionFlag {
  kind: AttentionFlagKind;
  /** One sentence saying what changed or is stuck. */
  statement: string;
  /** How many things the statement is about, when it is about a number of them. */
  count: number | null;
  /** The one thing to do about it and where that happens. */
  action: { label: string; href: string };
}

/** The health of the CV attached to the active profile, read from its latest review. */
export interface CvHealth {
  cvId: string;
  /** The latest review's overall score, 0–100. */
  score: number;
  verdict: CvVerdict;
  /** Score minus the previous review's score; null when this is the only review. */
  change: number | null;
  /** High-severity issues on the latest review. */
  highIssues: number;
  reviewedAt: Date;
}

/** The three first-run steps and whether each is done. */
export interface SetupState {
  /** A CV of the user's has been parsed. */
  cvParsed: boolean;
  /** An active profile exists with a parsed CV attached. */
  profileWithCv: boolean;
  /** At least one scoring run has produced matches for the current search. */
  scored: boolean;
  /** The first matches exist, so the Overview shows the search rather than the checklist. */
  complete: boolean;
}

export interface SearchState {
  profile: SearchProfile | null;
  setup: SetupState;
  /** The CV attached to the active profile: the one used for matching. */
  activeCv: Cv | null;
  /** Null without an active CV or before its first review. */
  cvHealth: CvHealth | null;
  /** At most MAX_ATTENTION_FLAGS things that changed or are stuck, most important first; empty when nothing needs attention. */
  flags: AttentionFlag[];
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
  const [profile, cvs] = await Promise.all([
    db.searchProfile.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
      include: { activeCv: true },
    }),
    db.cv.findMany({ where: { userId }, select: { parsed: true } }),
  ]);
  const cvParsed = cvs.some((c) => c.parsed !== null);
  const profileWithCv = profile?.activeCv?.parsed != null;
  if (!profile) {
    const setup: SetupState = { cvParsed, profileWithCv: false, scored: false, complete: false };
    return { profile: null, setup, activeCv: null, cvHealth: null, flags: [], stage, matches: { strong: [], wildcards: [], other: [] }, pipeline: { ...EMPTY_PIPELINE }, distribution: emptyDistribution(), lastScoredAt: null };
  }
  const { activeCv, ...profileRow } = profile;

  const rows = await db.matchScore.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isWildcard: "asc" }, { score: "desc" }],
    include: { jobPosting: { include: { source: true } } },
  });
  const postingIds = rows.map((m) => m.jobPostingId);
  const lastScoredAt = rows.reduce<Date | null>((latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest), null);
  const [applications, tailored, reviews, newPostings, failingSources] = await Promise.all([
    db.application.findMany({ where: { userId, jobPostingId: { in: postingIds } }, select: { jobPostingId: true, status: true } }),
    db.tailoredCv.findMany({ where: { jobPostingId: { in: postingIds }, cv: { userId } }, select: { jobPostingId: true } }),
    // The latest two reviews of the active CV: the reading and what it changed from.
    activeCv
      ? db.cvReview.findMany({
          where: { cvId: activeCv.id },
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { overallScore: true, verdict: true, createdAt: true, _count: { select: { issues: { where: { severity: "HIGH" } } } } },
        })
      : [],
    lastScoredAt ? db.jobPosting.count({ where: { fetchedAt: { gt: lastScoredAt } } }) : 0,
    db.jobSource.count({ where: { enabled: true, lastError: { not: null } } }),
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

  const scored = rows.length > 0;
  const setup: SetupState = { cvParsed, profileWithCv, scored, complete: scored };

  // Attention flags, in order of importance. Each is the count of things
  // behind it; a count of zero means the condition doesn't hold.
  const strongUnopened = main.filter((m) => isStrong(m) && !isOpened(m)).length;
  const draftsUnsent = applications.filter((a) => a.status === "DRAFT").length;
  const [latestReview, previousReview] = reviews;
  const cvHealth: CvHealth | null =
    activeCv && latestReview
      ? {
          cvId: activeCv.id,
          score: latestReview.overallScore,
          verdict: latestReview.verdict,
          change: previousReview ? latestReview.overallScore - previousReview.overallScore : null,
          highIssues: latestReview._count.issues,
          reviewedAt: latestReview.createdAt,
        }
      : null;
  const highIssues = cvHealth?.highIssues ?? 0;
  const wouldBeStrong = pipeline.strong === 0 ? main.filter((m) => m.locationMismatch && m.score + OUTSIDE_LOCATION_PENALTY >= STRONG_MATCH_MIN).length : 0;
  const flags = attentionFlags([
    { kind: "strong-unopened", count: strongUnopened, statement: `${plural(strongUnopened, "strong match", "strong matches")} you haven't opened`, action: { label: "Open them", href: stageHref("/dashboard/jobs", "strong") } },
    { kind: "drafts-unsent", count: draftsUnsent, statement: `${plural(draftsUnsent, "application draft", "application drafts")} not sent`, action: { label: "Finish drafts", href: stageHref("/dashboard/jobs", "prepared") } },
    { kind: "cv-high-issues", count: highIssues, statement: `${plural(highIssues, "high-severity issue", "high-severity issues")} open on your CV`, action: { label: "Review CV", href: "/dashboard/cv" } },
    { kind: "new-postings", count: newPostings, statement: `${plural(newPostings, "posting", "postings")} ingested since your last scoring run`, action: { label: "Refresh matches", href: "/dashboard/jobs" } },
    { kind: "location-blocked", count: wouldBeStrong, statement: `${plural(wouldBeStrong, "role", "roles")} would be strong matches but sit outside your locations`, action: { label: "Widen locations", href: "/dashboard/profile" } },
    { kind: "source-errors", count: failingSources, statement: `${plural(failingSources, "job source", "job sources")} reporting an error`, action: { label: "Check sources", href: "/dashboard#sources" } },
  ]);

  return { profile: profileRow, setup, activeCv, cvHealth, flags, stage, matches, pipeline, distribution, lastScoredAt };
}

function attentionFlags(candidates: AttentionFlag[]): AttentionFlag[] {
  return candidates.filter((f) => (f.count ?? 0) > 0).slice(0, MAX_ATTENTION_FLAGS);
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function emptyDistribution(): number[] {
  return Array.from({ length: DISTRIBUTION_BUCKETS }, () => 0);
}
