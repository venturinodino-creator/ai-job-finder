import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { renderCvDocx, renderCvText } from "@/lib/cvDocument";
import type { TailoredCvDocument } from "@/agents/cvTailor";

/** Downloads the user's tailored CV for this job as .docx (default) or .txt. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const format = new URL(req.url).searchParams.get("format") === "txt" ? "txt" : "docx";

    const tailored = await db.tailoredCv.findFirst({
      where: { jobPostingId, cv: { userId } },
      orderBy: { createdAt: "desc" },
      include: { jobPosting: { select: { company: true } } },
    });
    if (!tailored?.document) {
      throw new ApiError(404, "No tailored CV for this job yet — tailor it first.");
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
