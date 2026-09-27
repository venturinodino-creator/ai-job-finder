import { z } from "zod";
import { db } from "@/lib/db";
import { llmObject } from "@/lib/llm";

const tailoredDocumentSchema = z.object({
  name: z.string().describe("The candidate's name exactly as on the CV."),
  headline: z.string().describe("A role headline aligned to this posting, only as far as the CV honestly supports."),
  contact: z.string().nullable().describe("The CV's contact line copied verbatim (email, phone, location, links); null if the CV has none."),
  summary: z.string().describe("2-4 sentence professional summary tailored to this job, built only from CV facts."),
  experience: z.array(
    z.object({
      company: z.string().describe("Employer name exactly as on the CV."),
      title: z.string().describe("Job title exactly as on the CV."),
      dates: z.string().nullable().describe("Dates exactly as on the CV; null if absent."),
      bullets: z
        .array(z.string())
        .max(6)
        .describe("Achievements from the CV, reordered and rephrased to foreground what this posting values. Keep every number as-is."),
    }),
  ),
  skills: z.array(z.string()).describe("Skills and tools from the CV, most relevant to this posting first."),
  education: z.array(z.string()).describe("Education lines from the CV."),
  languages: z.array(z.string()).describe("Languages from the CV."),
  other: z.array(z.string()).describe("Awards, certifications, publications — only if they appear on the CV."),
});

export type TailoredCvDocument = z.infer<typeof tailoredDocumentSchema>;

const tailorSchema = z.object({
  suggestions: z.array(
    z.object({
      section: z.string().describe("e.g. 'Summary', 'Experience — Acme Corp', 'Skills'."),
      before: z.string().describe("The current text being changed, verbatim from the CV."),
      after: z.string().describe("The rewritten text, as it appears in the tailored document."),
      reason: z.string().describe("Why this change helps for this specific posting."),
    }),
  ),
  rewrittenSummary: z.string().describe("The tailored professional summary (same text as document.summary)."),
  document: tailoredDocumentSchema,
});

/**
 * Produces a complete tailored CV for one job plus the list of edits made,
 * and persists both on a TailoredCv row. The model is told not to invent
 * anything; enforceProvenance() then checks it — any employer, title,
 * qualification, language, award or skill that can't be traced back to the
 * uploaded CV's own text is dropped rather than shipped.
 */
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
      "You tailor a candidate's CV to one specific job posting without fabricating anything. Produce the " +
      "complete tailored CV as `document`. Hard rules: every employer, title, date, institution, award, " +
      "language, tool and number must come from the CV as written — never add skills, tools, certifications, " +
      "responsibilities or metrics the CV does not contain, and never inflate a number. You may reorder " +
      "sections and bullets, rephrase bullets to foreground what this posting values, adopt the posting's " +
      "vocabulary only where the CV genuinely supports it, and trim what is irrelevant. If the posting wants " +
      "something the CV lacks, leave it out of the document and note the gap in `suggestions` instead. " +
      "`suggestions` lists each substantive change you made (before → after → why).",
    prompt: `Job posting:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description.slice(0, 5000)}\n\nCandidate's current CV (the only source of truth):\n${cv.rawText.slice(0, 9000)}`,
  });

  const { document, dropped } = enforceProvenance(result.document, cv.rawText);
  if (dropped.length > 0) {
    console.warn(`Tailored CV ${cvId} for job ${jobPostingId}: dropped unsupported items —`, dropped);
  }

  return db.tailoredCv.upsert({
    where: { cvId_jobPostingId: { cvId, jobPostingId } },
    create: {
      cvId,
      jobPostingId,
      suggestions: result.suggestions,
      rewrittenText: result.rewrittenSummary,
      document,
    },
    update: {
      suggestions: result.suggestions,
      rewrittenText: result.rewrittenSummary,
      document,
    },
  });
}

/**
 * Keeps only facts the uploaded CV can vouch for. Bullet wording isn't checked
 * (rephrasing is the point); named entities are. A line counts as supported
 * when most of its significant words appear in the CV text, which tolerates
 * "B.Com in Marketing — UCT" vs "BCom Marketing, University of Cape Town"
 * while still rejecting an invented employer or certification.
 */
export function enforceProvenance(
  doc: TailoredCvDocument,
  rawText: string,
): { document: TailoredCvDocument; dropped: string[] } {
  const hay = rawText.toLowerCase();
  const dropped: string[] = [];
  const keep = (label: string, text: string) => {
    if (supported(text, hay)) return true;
    dropped.push(`${label}: ${text}`);
    return false;
  };

  return {
    document: {
      ...doc,
      experience: doc.experience.filter((e) => keep("experience", `${e.company} ${e.title}`)),
      skills: doc.skills.filter((s) => keep("skill", s)),
      education: doc.education.filter((e) => keep("education", e)),
      languages: doc.languages.filter((l) => keep("language", l)),
      other: doc.other.filter((o) => keep("other", o)),
    },
    dropped,
  };
}

function supported(text: string, hay: string): boolean {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length >= 4);
  if (words.length === 0) return hay.includes(text.toLowerCase().trim());
  const present = words.filter((w) => hay.includes(w)).length;
  return present / words.length >= 0.6;
}
