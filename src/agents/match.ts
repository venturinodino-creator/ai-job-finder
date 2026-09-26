import { z } from "zod";
import { db } from "@/lib/db";
import { cosineSimilarity, embedOne } from "@/lib/embeddings";
import { llmObject } from "@/lib/llm";
import type { SearchProfile, Cv, JobPosting } from "@/generated/prisma/client";

const CANDIDATE_POOL_SIZE = 40; // top-N by embedding similarity, fed to the LLM
const MAIN_MATCHES_PER_RUN = 15;
const WILDCARDS_PER_RUN = 3;
const POSTING_LOOKBACK_DAYS = 14;

const scoredJobSchema = z.object({
  results: z.array(
    z.object({
      jobId: z.string(),
      score: z.number().min(0).max(100),
      explanation: z.string().describe("One short sentence, e.g. 'strong skills fit; missing Kubernetes; location matches.'"),
      matchedSkills: z.array(z.string()),
      missingSkills: z.array(z.string()),
      isWildcard: z
        .boolean()
        .describe("True only for roles outside the exact target search that are still a strong skills fit."),
      wildcardReason: z
        .string()
        .nullable()
        .describe("Why this surprise pick is worth showing, e.g. 'adjacent title, same core skills'. Null when isWildcard is false."),
    }),
  ),
});

/** Scores recent job postings against one search profile and persists MatchScore rows. */
export async function runMatchForProfile(profileId: string): Promise<number> {
  const profile = await db.searchProfile.findUniqueOrThrow({
    where: { id: profileId },
    include: { activeCv: true },
  });

  const candidates = await db.jobPosting.findMany({
    where: { postedAt: { gte: daysAgo(POSTING_LOOKBACK_DAYS) } },
    orderBy: { postedAt: "desc" },
    take: 500,
  });
  if (candidates.length === 0) return 0;

  const profileText = buildProfileText(profile, profile.activeCv);
  const shortlist = await buildShortlist(profileText, candidates);
  if (shortlist.length === 0) return 0;

  const scored = await llmObject({
    schema: scoredJobSchema,
    system:
      "You score job postings against a candidate's profile and CV. Be concrete and honest in explanations; " +
      "flag isWildcard=true only for jobs outside the candidate's exact target roles/industries that are still " +
      "a genuinely strong skills fit (adjacent titles, transferable skills, adjacent industries).",
    prompt: buildScoringPrompt(profileText, shortlist),
  });

  const byId = new Map(scored.results.map((r) => [r.jobId, r]));
  const mainCandidates = scored.results.filter((r) => !r.isWildcard).sort((a, b) => b.score - a.score);
  const wildcardCandidates = scored.results.filter((r) => r.isWildcard).sort((a, b) => b.score - a.score);

  const toPersist = [
    ...mainCandidates.slice(0, MAIN_MATCHES_PER_RUN),
    ...wildcardCandidates.slice(0, WILDCARDS_PER_RUN),
  ];

  for (const result of toPersist) {
    if (!byId.has(result.jobId)) continue;
    await db.matchScore.upsert({
      where: { profileId_jobPostingId: { profileId: profile.id, jobPostingId: result.jobId } },
      create: {
        profileId: profile.id,
        jobPostingId: result.jobId,
        score: Math.round(result.score),
        explanation: result.explanation,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        isWildcard: result.isWildcard,
        wildcardReason: result.wildcardReason,
      },
      update: {
        score: Math.round(result.score),
        explanation: result.explanation,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        isWildcard: result.isWildcard,
        wildcardReason: result.wildcardReason,
      },
    });
  }

  return toPersist.length;
}

/**
 * Anthropic has no embeddings endpoint, and embeddings are only a cost-saving
 * pre-filter — so they're optional. With an embeddings key configured, rank
 * by cosine similarity and take the top N; without one, just take the N most
 * recently posted candidates (already the query's sort order) and let the
 * LLM score all of them directly.
 */
async function buildShortlist(profileText: string, candidates: JobPosting[]): Promise<JobPosting[]> {
  let profileEmbedding: number[];
  try {
    profileEmbedding = await embedOne(profileText);
  } catch (err) {
    console.warn("Skipping embedding pre-filter for this match run:", err instanceof Error ? err.message : err);
    return candidates.slice(0, CANDIDATE_POOL_SIZE);
  }

  const withEmbeddings = candidates.filter((job) => job.embedding.length > 0);
  if (withEmbeddings.length === 0) return candidates.slice(0, CANDIDATE_POOL_SIZE);

  return withEmbeddings
    .map((job) => ({ job, similarity: cosineSimilarity(profileEmbedding, job.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, CANDIDATE_POOL_SIZE)
    .map((r) => r.job);
}

function buildProfileText(profile: SearchProfile, cv: Cv | null): string {
  const parts = [
    `Target roles: ${profile.targetRoles.join(", ") || "any"}.`,
    `Locations: ${profile.locations.join(", ") || "any"}.`,
    `Remote preference: ${profile.remotePref}.`,
    profile.seniority ? `Seniority: ${profile.seniority}.` : null,
    profile.salaryMin || profile.salaryMax
      ? `Salary range: ${profile.salaryMin ?? "?"}-${profile.salaryMax ?? "?"} ${profile.salaryCurrency ?? ""}.`
      : null,
    profile.industries.length ? `Industries: ${profile.industries.join(", ")}.` : null,
    profile.languages.length ? `Languages: ${profile.languages.join(", ")}.` : null,
    cv?.rawText ? `CV:\n${cv.rawText.slice(0, 6000)}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function buildScoringPrompt(profileText: string, jobs: JobPosting[]): string {
  const jobBlocks = jobs
    .map(
      (job) =>
        `### Job ${job.id}\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location ?? "n/a"}\nRemote: ${job.remoteType}\nIndustries: ${job.industries.join(", ")}\nDescription: ${job.description.slice(0, 1500)}`,
    )
    .join("\n\n");

  return `Candidate profile:\n${profileText}\n\nScore every job below against this candidate (0-100). Return one result per job id.\n\n${jobBlocks}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
