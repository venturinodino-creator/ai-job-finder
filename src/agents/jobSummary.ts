import { z } from "zod";
import { db } from "@/lib/db";
import { llmObject } from "@/lib/llm";

export const jobSummarySchema = z.object({
  oneLiner: z.string().describe("One sentence: what the role is and who it is for."),
  responsibilities: z.array(z.string()).max(6).describe("The 3-6 things you would actually do, as short bullets."),
  mustHaves: z
    .array(z.string())
    .max(6)
    .describe("Hard requirements the posting states: years, skills, location, language, right to work."),
  niceToHaves: z.array(z.string()).max(5).describe("Preferred but optional, if the posting lists any."),
  compensation: z
    .string()
    .nullable()
    .describe("Salary, OTE, commission, equity or notable benefits if stated; null if not mentioned."),
  locationAndRemote: z
    .string()
    .nullable()
    .describe("Where the role is based and the remote/hybrid policy, if stated; null if not mentioned."),
});

export type JobSummary = z.infer<typeof jobSummarySchema>;

/** Returns the cached summary for a posting, generating and storing it on first request. */
export async function getOrCreateJobSummary(jobPostingId: string): Promise<JobSummary> {
  const job = await db.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } });
  if (job.summary) return job.summary as unknown as JobSummary;

  const summary = await llmObject({
    schema: jobSummarySchema,
    system:
      "You condense job postings for a candidate skimming a feed. Use only what the posting says — never infer " +
      "salary, remote policy or requirements that aren't stated. Keep every bullet under ~15 words. Strip " +
      "company marketing fluff; keep what decides whether to apply.",
    prompt: `Title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location ?? "n/a"}\nRemote: ${job.remoteType}\n\nDescription:\n${job.description.slice(0, 12000)}`,
  });

  await db.jobPosting.update({ where: { id: jobPostingId }, data: { summary } });
  return summary;
}
