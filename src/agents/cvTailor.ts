import { z } from "zod";
import { db } from "@/lib/db";
import { llmObject } from "@/lib/llm";

const tailorSchema = z.object({
  suggestions: z.array(
    z.object({
      section: z.string().describe("e.g. 'Summary', 'Experience — Acme Corp', 'Skills'."),
      before: z.string().describe("The current text being replaced, verbatim from the CV."),
      after: z.string().describe("The rewritten text, tailored to this job posting."),
      reason: z.string().describe("Why this change helps for this specific posting."),
    }),
  ),
  rewrittenSummary: z
    .string()
    .describe("A 2-4 sentence professional summary tailored to this job, ready to paste at the top of the CV."),
});

/** Suggests concrete edits to tailor one CV towards one job posting. Persists a TailoredCv row. */
export async function tailorCvForJob(cvId: string, jobPostingId: string) {
  const [cv, job] = await Promise.all([
    db.cv.findUniqueOrThrow({ where: { id: cvId } }),
    db.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
  ]);
  if (!cv.rawText) {
    throw new Error("CV has not been parsed yet — call parseCv() first.");
  }

  const result = await llmObject({
    schema: tailorSchema,
    system:
      "You help candidates tailor their CV to a specific job posting without fabricating experience. Only " +
      "rephrase, reorder, or emphasize existing content — never invent skills or achievements the CV doesn't " +
      "support.",
    prompt: `Job posting:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description.slice(0, 4000)}\n\nCandidate's current CV:\n${cv.rawText.slice(0, 8000)}`,
  });

  return db.tailoredCv.upsert({
    where: { cvId_jobPostingId: { cvId, jobPostingId } },
    create: {
      cvId,
      jobPostingId,
      suggestions: result.suggestions,
      rewrittenText: result.rewrittenSummary,
    },
    update: {
      suggestions: result.suggestions,
      rewrittenText: result.rewrittenSummary,
    },
  });
}
