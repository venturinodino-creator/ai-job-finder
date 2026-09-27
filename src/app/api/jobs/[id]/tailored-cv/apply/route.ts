import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { applyEditsToDocx } from "@/lib/docxEdit";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bodySchema = z.object({ accepted: z.array(z.number().int().min(0)).optional() });

interface Suggestion {
  section: string;
  before: string;
  after: string;
  reason: string;
  kind?: "edit" | "note";
}

/**
 * Applies the accepted tailoring changes inside the candidate's own uploaded
 * .docx, keeping its layout, and stores the result as this job's preferred
 * attachment. Reports exactly which changes landed and which couldn't be
 * matched to a paragraph.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const { accepted } = bodySchema.parse(await req.json().catch(() => ({})));

    const tailored = await db.tailoredCv.findFirst({
      where: { jobPostingId, cv: { userId } },
      orderBy: { createdAt: "desc" },
      include: { cv: true, jobPosting: { select: { company: true } } },
    });
    if (!tailored) throw new ApiError(404, "Tailor your CV to this job first.");
    if (tailored.cv.mimeType !== DOCX_MIME) {
      throw new ApiError(
        400,
        "Your uploaded CV is a PDF, and edits can't be applied inside a PDF without breaking its layout. Upload the Word (.docx) version of your CV on the CV page, then tailor again.",
      );
    }

    const suggestions = tailored.suggestions as unknown as Suggestion[];
    // Gap notes describe what the CV lacks; there's nothing to write for them.
    const chosenIndex = suggestions
      .map((s, i) => i)
      .filter((i) => suggestions[i].kind !== "note" && (!accepted || accepted.includes(i)));
    const chosen = chosenIndex.map((i) => suggestions[i]);
    if (chosen.length === 0) throw new ApiError(400, "Select at least one change to apply.");

    const storage = getStorage();
    const original = await storage.get(tailored.cv.storageKey);
    const result = await applyEditsToDocx(original, chosen);

    const key = `${userId}/${nanoid()}-tailored-${safeName(tailored.jobPosting.company)}.docx`;
    await storage.put(key, result.buffer);
    if (tailored.editedStorageKey) {
      await storage.delete(tailored.editedStorageKey).catch(() => undefined);
    }

    // Map back to indices in the full suggestion list, so the UI can mark
    // exactly which items landed.
    const report = {
      applied: result.applied.map((i) => chosenIndex[i]),
      notFound: result.notFound.map((i) => chosenIndex[i]),
      generatedAt: new Date().toISOString(),
    };
    await db.tailoredCv.update({ where: { id: tailored.id }, data: { editedStorageKey: key, editReport: report } });

    return NextResponse.json({ report });
  });
}

function safeName(value: string): string {
  return value.replace(/[^\w\s.-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "CV";
}
