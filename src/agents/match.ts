import { z } from "zod";
import { db } from "@/lib/db";
import { cosineSimilarity, embedOne } from "@/lib/embeddings";
import { llmObject } from "@/lib/llm";
import type { SearchProfile, Cv, JobPosting, Seniority } from "@/generated/prisma/client";

const CANDIDATE_POOL_SIZE = 40; // top-N by relevance, fed to the LLM
const MIN_RELEVANT_POOL = 10; // below this many overlapping postings, top up with recent ones
const EMBEDDING_WEIGHT = 8; // cosine similarity is 0-1; lexical scores run roughly 0-25
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
  const shortlist = await buildShortlist(profile, profile.activeCv, profileText, candidates);
  if (shortlist.length === 0) return 0;

  const scored = await llmObject({
    schema: scoredJobSchema,
    system:
      "You score job postings against a candidate's profile and CV on a 0-100 scale. Role-family alignment " +
      "dominates: 85-100 = same role family (e.g. account/channel/sales management, or backend engineering) AND " +
      "matching seniority AND most key skills; 65-84 = same role family with some gaps; 40-64 = an adjacent role " +
      "family with clearly transferable skills; below 40 = a different function (e.g. engineering vs sales vs " +
      "marketing), no matter how well the company, industry or location fit — never score a different function " +
      "above 39. Be concrete and honest in explanations, leading with role fit. Flag isWildcard=true only for " +
      "jobs outside the candidate's exact target roles/industries that are still a genuinely strong skills fit " +
      "(adjacent titles, transferable skills, adjacent industries).",
    prompt: buildScoringPrompt(profileText, shortlist),
  });

  // Only persist scores for postings we actually sent. The LLM occasionally
  // returns an id it invented or mistyped; writing that would violate the
  // MatchScore -> JobPosting foreign key and abort the whole run.
  const shortlistIds = new Set(shortlist.map((job) => job.id));
  const valid = scored.results.filter((r) => shortlistIds.has(r.jobId));
  const dropped = scored.results.length - valid.length;
  if (dropped > 0) {
    console.warn(`[match] dropped ${dropped} scored result(s) with unknown job ids for profile ${profile.id}`);
  }

  const mainCandidates = valid.filter((r) => !r.isWildcard).sort((a, b) => b.score - a.score);
  const wildcardCandidates = valid.filter((r) => r.isWildcard).sort((a, b) => b.score - a.score);

  const toPersist = [
    ...mainCandidates.slice(0, MAIN_MATCHES_PER_RUN),
    ...wildcardCandidates.slice(0, WILDCARDS_PER_RUN),
  ];

  for (const result of toPersist) {
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
 * Picks which postings the LLM gets to score. Lexical relevance (target-role
 * phrases in the title above all, then industries, CV skills, seniority and
 * location fit) always applies, so the shortlist is never just "whatever was
 * posted most recently" — that fallback is how a sales profile ended up with
 * a feed of engineering roles when no embeddings key was configured.
 * Embeddings are optional (Anthropic has no embeddings endpoint) and only
 * sharpen the ranking when present.
 */
async function buildShortlist(
  profile: SearchProfile,
  cv: Cv | null,
  profileText: string,
  candidates: JobPosting[],
): Promise<JobPosting[]> {
  const lexical = new Map(candidates.map((job) => [job.id, lexicalRelevance(profile, cv, job)]));

  let similarity = new Map<string, number>();
  try {
    const profileEmbedding = await embedOne(profileText);
    similarity = new Map(
      candidates
        .filter((job) => job.embedding.length > 0)
        .map((job) => [job.id, cosineSimilarity(profileEmbedding, job.embedding)]),
    );
  } catch (err) {
    console.warn("No embeddings for this match run (lexical relevance only):", err instanceof Error ? err.message : err);
  }

  const ranked = candidates
    .map((job) => ({ job, score: (lexical.get(job.id) ?? 0) + (similarity.get(job.id) ?? 0) * EMBEDDING_WEIGHT }))
    .sort((a, b) => b.score - a.score);

  const relevant = ranked.filter((r) => r.score > 0).slice(0, CANDIDATE_POOL_SIZE).map((r) => r.job);
  if (relevant.length >= MIN_RELEVANT_POOL) return relevant;

  // Thin pool (new profile, sparse sources): top up with recent postings so
  // the scorer still has something to say, rather than returning nothing.
  const seen = new Set(relevant.map((job) => job.id));
  return [...relevant, ...candidates.filter((job) => !seen.has(job.id))].slice(0, CANDIDATE_POOL_SIZE);
}

const STOPWORDS = new Set(["the", "and", "for", "with", "our", "you", "your", "this", "that", "are", "will"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

const SENIORITY_WORDS: Partial<Record<Seniority, string[]>> = {
  INTERN: ["intern", "internship"],
  JUNIOR: ["junior", "graduate", "entry"],
  MID: ["mid"],
  SENIOR: ["senior", "sr"],
  STAFF: ["staff"],
  PRINCIPAL: ["principal"],
  MANAGER: ["manager", "lead", "head"],
  DIRECTOR: ["director"],
  EXECUTIVE: ["vp", "chief", "executive"],
};

const CLASHING_LEVEL_WORDS: Partial<Record<Seniority, string[]>> = {
  INTERN: ["senior", "director", "principal", "head", "vp"],
  JUNIOR: ["senior", "director", "principal", "head", "vp", "staff"],
  SENIOR: ["intern", "internship", "junior", "graduate"],
  STAFF: ["intern", "internship", "junior", "graduate"],
  PRINCIPAL: ["intern", "internship", "junior", "graduate"],
  MANAGER: ["intern", "internship", "junior", "graduate"],
  DIRECTOR: ["intern", "internship", "junior", "graduate"],
  EXECUTIVE: ["intern", "internship", "junior", "graduate"],
};

function lexicalRelevance(profile: SearchProfile, cv: Cv | null, job: JobPosting): number {
  const title = job.title.toLowerCase();
  const titleTokens = new Set(tokens(job.title));
  const body = job.description.toLowerCase();
  let score = 0;

  for (const role of profile.targetRoles) {
    const phrase = role.toLowerCase().trim();
    if (!phrase) continue;
    if (title.includes(phrase)) score += 10;
    else if (body.includes(phrase)) score += 3;
    for (const word of tokens(role)) {
      if (titleTokens.has(word)) score += 3;
      else if (body.includes(word)) score += 1;
    }
  }

  for (const industry of profile.industries) {
    const term = industry.toLowerCase().trim();
    if (!term) continue;
    if (title.includes(term) || job.industries.some((i) => i.toLowerCase().includes(term))) score += 2;
    else if (body.includes(term)) score += 1;
  }

  const parsed = cv?.parsed as { skills?: string[] } | null;
  let skillHits = 0;
  for (const skill of parsed?.skills ?? []) {
    if (skill.length >= 3 && body.includes(skill.toLowerCase())) skillHits++;
  }
  score += Math.min(skillHits, 10) * 0.5;

  if (profile.seniority) {
    if ((SENIORITY_WORDS[profile.seniority] ?? []).some((w) => titleTokens.has(w))) score += 2;
    if ((CLASHING_LEVEL_WORDS[profile.seniority] ?? []).some((w) => titleTokens.has(w))) score -= 4;
  }
  if (profile.remotePref === "REMOTE" && job.remoteType === "ON_SITE") score -= 3;
  if (profile.locations.length > 0 && job.location) {
    const loc = job.location.toLowerCase();
    if (profile.locations.some((l) => loc.includes(l.toLowerCase().trim()))) score += 3;
  }

  return score;
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
    profile.expectsCommission
      ? "Compensation: expects commission / variable pay (OTE, sales commission) on top of base salary — favour roles that offer it."
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
