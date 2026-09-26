import { z } from "zod";
import { db } from "@/lib/db";
import { llmObject } from "@/lib/llm";

const reviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  verdict: z.enum(["STRONG", "GOOD", "NEEDS_WORK", "WEAK"]),
  summary: z.string().describe("2-3 sentence overview of the CV's quality."),
  strengths: z.array(z.string()),
  atsCompatible: z.boolean(),
  atsNotes: z.string().nullable(),
  issues: z.array(
    z.object({
      category: z.enum([
        "MISSING_KEYWORDS",
        "WEAK_BULLET",
        "STRUCTURE",
        "FORMATTING",
        "ATS_COMPATIBILITY",
        "QUANTIFICATION",
        "OTHER",
      ]),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
      description: z.string(),
      suggestion: z.string().describe("A specific, actionable fix — quote the weak text and show the improved version when relevant."),
    }),
  ),
});

/**
 * Rates a CV and generates concrete, actionable fixes. Persists a new
 * CvReview + CvIssue rows — previous reviews for this CV are kept (not
 * overwritten) so the analytics page can chart score history over time.
 */
export async function reviewCv(cvId: string) {
  const cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } });
  if (!cv.rawText) {
    throw new Error("CV has not been parsed yet — call parseCv() first.");
  }

  const result = await llmObject({
    schema: reviewSchema,
    system:
      "You are an expert technical recruiter and resume reviewer. Rate this CV and give specific, actionable " +
      "fixes: missing keywords, weak bullet points, structure, formatting, ATS compatibility, and quantified " +
      "achievements. Be concrete — reference actual text from the CV, don't give generic advice.",
    prompt: cv.rawText.slice(0, 12000),
  });

  return db.cvReview.create({
    data: {
      cvId,
      overallScore: Math.round(result.overallScore),
      verdict: result.verdict,
      summary: result.summary,
      strengths: result.strengths,
      atsCompatible: result.atsCompatible,
      atsNotes: result.atsNotes,
      issues: { create: result.issues },
    },
    include: { issues: true },
  });
}
