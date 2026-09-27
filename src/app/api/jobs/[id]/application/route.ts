import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, requireUserId } from "@/lib/api";
import { isEmailConfigured } from "@/lib/email";
import { prepareApplication, updateDraft } from "@/lib/applications";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const application = await db.application.findUnique({
      where: { userId_jobPostingId: { userId, jobPostingId } },
      include: { jobPosting: { select: { id: true, title: true, company: true, url: true, applyEmail: true } }, tailoredCv: { select: { id: true } }, cv: { select: { id: true, fileName: true } } },
    });
    return NextResponse.json({ application, emailEnabled: isEmailConfigured() });
  });
}

/** Prepares (or re-drafts) the application: chooses the CV and drafts the cover note. */
export async function POST(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const application = await prepareApplication(userId, jobPostingId);
    return NextResponse.json({ application, emailEnabled: isEmailConfigured() });
  });
}

const patchSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  coverNote: z.string().min(1).max(5000).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const body = patchSchema.parse(await req.json());
    const application = await updateDraft(userId, jobPostingId, body);
    return NextResponse.json({ application, emailEnabled: isEmailConfigured() });
  });
}
