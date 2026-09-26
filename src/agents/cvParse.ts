import { z } from "zod";
import mammoth from "mammoth";
import { db } from "@/lib/db";
import { embedOne } from "@/lib/embeddings";
import { llmObject } from "@/lib/llm";
import { getStorage } from "@/lib/storage";

const parsedCvSchema = z.object({
  name: z.string().nullable(),
  headline: z.string().nullable().describe("Current or target job title, if stated."),
  skills: z.array(z.string()),
  yearsOfExperience: z.number().nullable(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      highlights: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
    }),
  ),
  languages: z.array(z.string()),
});

export type ParsedCv = z.infer<typeof parsedCvSchema>;

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    // Imported lazily: pdf-parse (via pdfjs-dist) runs polyfill/setup code as
    // soon as it's loaded, which throws on serverless runtimes missing a
    // DOMMatrix polyfill (e.g. Vercel functions). A top-level import would
    // break every CV upload, PDF or not; loading it only for actual PDFs
    // keeps that failure scoped to PDFs specifically.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text fallback.
  return buffer.toString("utf-8");
}

/** Extracts text, asks the LLM for structured fields, embeds the CV, and persists all three. */
export async function parseCv(cvId: string): Promise<ParsedCv> {
  const cv = await db.cv.findUniqueOrThrow({ where: { id: cvId } });
  const storage = getStorage();
  const buffer = await storage.get(cv.storageKey);

  const rawText = await extractText(buffer, cv.mimeType);

  const parsed = await llmObject({
    schema: parsedCvSchema,
    system: "Extract structured fields from a CV/resume. Leave fields null/empty when not present. Do not invent data.",
    prompt: rawText.slice(0, 12000),
  });

  const embedding = await safeEmbed(`${parsed.headline ?? ""} ${parsed.skills.join(", ")} ${rawText}`);

  await db.cv.update({
    where: { id: cv.id },
    data: { rawText, parsed, embedding },
  });

  return parsed;
}

/** No embeddings provider (e.g. Anthropic-only setups) shouldn't block CV parsing — it's only used as a pre-filter. */
async function safeEmbed(text: string): Promise<number[]> {
  try {
    return await embedOne(text);
  } catch (err) {
    console.warn("Skipping CV embedding:", err instanceof Error ? err.message : err);
    return [];
  }
}
