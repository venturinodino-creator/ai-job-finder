/**
 * The compact form of a match that gets frozen into a SearchHistory row when
 * a search profile changes: enough to browse the old feed (title, company,
 * score, why) and jump to the posting, without keeping MatchScore rows alive.
 * Pure: no DB access.
 */

export interface ArchivedResult {
  jobPostingId: string;
  title: string;
  company: string;
  location: string | null;
  source: string;
  url: string;
  score: number;
  isWildcard: boolean;
  explanation: string;
  applied: boolean;
}

type MatchLike = {
  score: number;
  isWildcard: boolean;
  explanation: string;
  appliedAt: Date | null;
  jobPosting: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    url: string;
    source: { name: string };
  };
};

/** Best matches first, wildcards after, capped so a row stays small. */
export function toArchivedResults(matches: MatchLike[], max = 60): ArchivedResult[] {
  return [...matches]
    .sort((a, b) => Number(a.isWildcard) - Number(b.isWildcard) || b.score - a.score)
    .slice(0, max)
    .map((m) => ({
      jobPostingId: m.jobPosting.id,
      title: m.jobPosting.title,
      company: m.jobPosting.company,
      location: m.jobPosting.location,
      source: m.jobPosting.source.name,
      url: m.jobPosting.url,
      score: m.score,
      isWildcard: m.isWildcard,
      explanation: m.explanation,
      applied: m.appliedAt !== null,
    }));
}

/** Reads results back out of the Json column defensively. */
export function parseArchivedResults(value: unknown): ArchivedResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is ArchivedResult =>
      typeof r === "object" && r !== null && typeof (r as ArchivedResult).jobPostingId === "string" && typeof (r as ArchivedResult).title === "string",
  );
}
