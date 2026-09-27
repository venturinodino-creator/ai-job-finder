import { z } from "zod";
import { llmObject } from "@/lib/llm";
import type { JobPosting, SearchProfile } from "@/generated/prisma/client";
import type { JobSummary } from "./jobSummary";

const coverNoteSchema = z.object({
  subject: z.string().describe("Email subject, e.g. 'Application: Senior Account Manager — <Candidate name>'."),
  body: z
    .string()
    .describe(
      "120-180 words of plain text in 3 short paragraphs: why this role, 2-3 concrete relevant achievements " +
        "drawn from the CV, and a brief close. Ends with a sign-off using the candidate's name.",
    ),
});

export type CoverNote = z.infer<typeof coverNoteSchema>;

/** Drafts a short application note for one job, using only what the CV supports. */
export async function generateCoverNote(params: {
  candidateName: string;
  profile: SearchProfile;
  sourceCvText: string;
  job: JobPosting;
  summary: JobSummary | null;
}): Promise<CoverNote> {
  const { candidateName, profile, sourceCvText, job, summary } = params;

  const roleContext = summary
    ? `Role in brief: ${summary.oneLiner}\nMust-haves: ${summary.mustHaves.join("; ")}\nResponsibilities: ${summary.responsibilities.join("; ")}`
    : `Description: ${job.description.slice(0, 3000)}`;

  const note = await llmObject({
    schema: coverNoteSchema,
    system:
      "You write short, specific job-application notes for a candidate. Use only facts that appear in the " +
      "candidate's CV text — never invent employers, results, tools or numbers, and never round a figure up. " +
      "Pick the 2-3 achievements most relevant to this posting and say plainly why they matter for it. No " +
      "clichés, no flattery of the company, no salary talk. Plain text, no markdown, no placeholders.",
    prompt:
      `Candidate: ${candidateName}\nTarget roles: ${profile.targetRoles.join(", ") || "n/a"}\n\n` +
      `Job: ${job.title} at ${job.company}\n${roleContext}\n\nCandidate's CV (the only source of truth):\n${sourceCvText.slice(0, 7000)}`,
  });

  return { subject: note.subject, body: stripUnsupportedClaims(note.body, sourceCvText) };
}

/**
 * Anti-inflation guard: any sentence containing a number that doesn't appear
 * in the source CV (5.2M, 18%, 25, 2019…) is removed rather than sent.
 * Numbers are compared as whole tokens, so "8 years" is not vouched for by
 * an "18%" elsewhere in the CV.
 */
export function stripUnsupportedClaims(body: string, source: string): string {
  const allowed = numericCores(source);
  const sentences = body.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => [...numericCores(sentence)].every((n) => allowed.has(n)));
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

function numericCores(text: string): Set<string> {
  const cores = new Set<string>();
  for (const raw of text.match(/\d[\d.,]*/g) ?? []) {
    const core = raw.replace(/[.,]+$/, "").replace(/,/g, "");
    if (core) cores.add(core);
  }
  return cores;
}
