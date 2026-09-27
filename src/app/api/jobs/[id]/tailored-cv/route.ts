import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { renderCvDocx, renderCvText } from "@/lib/cvDocument";
import type { TailoredCvDocument } from "@/agents/cvTailor";

/**
 * Downloads the tailored CV for this job. `format=original` is the candidate's
 * own .docx with the accepted changes applied in place (their layout);
 * `docx`/`txt` are the plain generated layout.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const requested = new URL(req.url).searchParams.get("format");
    const format = requested === "txt" ? "txt" : requested === "original" ? "original" : "docx";

    // Serve the tailoring made for the currently active CV (see apply route).
    const profile = await db.searchProfile.findFirst({
      where: { userId, isActive: true },
      select: { activeCv: { select: { id: true } } },
    });
    const tailored = profile?.activeCv
      ? await db.tailoredCv.findUnique({
          where: { cvId_jobPostingId: { cvId: profile.activeCv.id, jobPostingId } },
          include: { jobPosting: { select: { company: true } }, cv: { select: { fileName: true } } },
        })
      : null;
    if (!tailored) {
      throw new ApiError(404, "No tailored CV for this job yet — tailor it first.");
    }

    if (format === "original") {
      if (!tailored.editedStorageKey) {
        throw new ApiError(404, "No edited copy of your CV yet — apply the changes first.");
      }
      const content = await getStorage().get(tailored.editedStorageKey);
      const base = tailored.cv.fileName.replace(/\.docx$/i, "");
      return new NextResponse(new Uint8Array(content), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeName(base)} - ${safeName(tailored.jobPosting.company)}.docx"`,
        },
      });
    }

    if (!tailored.document) {
      throw new ApiError(404, "No tailored CV document for this job yet — tailor it first.");
    }
    const doc = tailored.document as unknown as TailoredCvDocument;
    const filename = `${safeName(doc.name)} - CV - ${safeName(tailored.jobPosting.company)}`;

    if (format === "txt") {
      return new NextResponse(renderCvText(doc), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.txt"`,
        },
      });
    }

    const buffer = await renderCvDocx(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  });
}

function safeName(value: string): string {
  return value.replace(/[^\w\s.-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "CV";
}
