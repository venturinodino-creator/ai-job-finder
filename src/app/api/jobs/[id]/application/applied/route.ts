import { NextRequest, NextResponse } from "next/server";
import { handle, requireUserId } from "@/lib/api";
import { markAlreadyApplied, undoApplied } from "@/lib/applications";

type Params = { params: Promise<{ id: string }> };

/** "I already applied": records the posting as applied without a draft or a cover note. */
export async function POST(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const application = await markAlreadyApplied(userId, jobPostingId);
    return NextResponse.json({ application });
  });
}

/** Undo for an applied state that did not send an email. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    return NextResponse.json(await undoApplied(userId, jobPostingId));
  });
}
