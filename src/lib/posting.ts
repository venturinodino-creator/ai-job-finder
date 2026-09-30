import { STRONG_MATCH_MIN } from "@/lib/pipelineStages";
import type { ArchivedResult } from "@/lib/archivedResults";

// The one shape the Posting card renders, and the adapters from each view's
// rows to it. Pure: no database, no React.

/** What the current search says about a posting, when it has scored it. */
export interface PostingReading {
  score: number;
  isWildcard: boolean;
  explanation: string | null;
  wildcardReason: string | null;
  /** Marked applied, or sent by email. */
  applied: boolean;
  /** Outside the profile's locations, so the score carries the location penalty. */
  locationMismatch: boolean;
}

export interface PostingSummary {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remoteType: string | null;
  sourceName: string;
  postedAt: Date | null;
  /** Null when the active profile has not scored this posting. */
  reading: PostingReading | null;
}

export type ReadingTone = "accent" | "secondary" | "gamify";

/** Wildcards read in the gamify tone, strong matches in the secondary tone, everything else in the accent. */
export function readingTone(reading: { score: number; isWildcard: boolean }): ReadingTone {
  return reading.isWildcard ? "gamify" : reading.score >= STRONG_MATCH_MIN ? "secondary" : "accent";
}

type MatchRow = {
  score: number;
  isWildcard: boolean;
  explanation: string;
  wildcardReason: string | null;
  appliedAt: Date | null;
  locationMismatch: boolean;
  jobPosting: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    remoteType: string;
    postedAt: Date | null;
    source: { name: string };
  };
};

/** A row of the Matches view. */
export function postingFromMatch(m: MatchRow): PostingSummary {
  const job = m.jobPosting;
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    remoteType: job.remoteType,
    sourceName: job.source.name,
    postedAt: job.postedAt,
    reading: {
      score: m.score,
      isWildcard: m.isWildcard,
      explanation: m.explanation,
      wildcardReason: m.wildcardReason,
      applied: m.appliedAt !== null,
      locationMismatch: m.locationMismatch,
    },
  };
}

type CompanyRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remoteType: string;
  postedAt: Date | null;
  source: { name: string };
  match: { score: number; isWildcard: boolean; appliedAt: Date | null; locationMismatch?: boolean } | null;
};

/** A row of the Companies view: scored only if the active profile has met it. */
export function postingFromCompanyPosting(p: CompanyRow): PostingSummary {
  return {
    id: p.id,
    title: p.title,
    company: p.company,
    location: p.location,
    remoteType: p.remoteType,
    sourceName: p.source.name,
    postedAt: p.postedAt,
    reading: p.match
      ? {
          score: p.match.score,
          isWildcard: p.match.isWildcard,
          explanation: null,
          wildcardReason: null,
          applied: p.match.appliedAt !== null,
          locationMismatch: p.match.locationMismatch ?? false,
        }
      : null,
  };
}

/** A row of the Archive: what the feed showed when the search was replaced. */
export function postingFromArchivedResult(r: ArchivedResult): PostingSummary {
  return {
    id: r.jobPostingId,
    title: r.title,
    company: r.company,
    location: r.location,
    remoteType: null,
    sourceName: r.source,
    postedAt: null,
    reading: {
      score: r.score,
      isWildcard: r.isWildcard,
      explanation: r.explanation,
      wildcardReason: null,
      applied: r.applied,
      locationMismatch: false,
    },
  };
}
