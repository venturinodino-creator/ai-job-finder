import { db } from "@/lib/db";

export interface AnalyticsSummary {
  cvScoreHistory: { date: string; score: number }[];
  jobsFunnel: { totalMatches: number; viewed: number; applied: number };
  scoreDistribution: { bucket: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
}

const SCORE_BUCKETS = [
  { label: "0-20", min: 0, max: 20 },
  { label: "21-40", min: 21, max: 40 },
  { label: "41-60", min: 41, max: 60 },
  { label: "61-80", min: 61, max: 80 },
  { label: "81-100", min: 81, max: 100 },
];

/** Aggregates everything the personal analytics dashboard renders, for one user. */
export async function getAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
  const [reviews, matches] = await Promise.all([
    db.cvReview.findMany({
      where: { cv: { userId } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, overallScore: true },
    }),
    db.matchScore.findMany({
      where: { profile: { userId } },
      select: { score: true, viewedAt: true, appliedAt: true, jobPosting: { select: { source: { select: { name: true } } } } },
    }),
  ]);

  const cvScoreHistory = reviews.map((r) => ({
    date: r.createdAt.toISOString().slice(0, 10),
    score: r.overallScore,
  }));

  const jobsFunnel = {
    totalMatches: matches.length,
    viewed: matches.filter((m) => m.viewedAt).length,
    applied: matches.filter((m) => m.appliedAt).length,
  };

  const scoreDistribution = SCORE_BUCKETS.map((b) => ({
    bucket: b.label,
    count: matches.filter((m) => m.score >= b.min && m.score <= b.max).length,
  }));

  const bySource = new Map<string, number>();
  for (const m of matches) {
    const name = m.jobPosting.source.name;
    bySource.set(name, (bySource.get(name) ?? 0) + 1);
  }
  const sourceBreakdown = Array.from(bySource.entries()).map(([source, count]) => ({ source, count }));

  return { cvScoreHistory, jobsFunnel, scoreDistribution, sourceBreakdown };
}
