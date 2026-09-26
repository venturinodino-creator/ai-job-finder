import { NextResponse } from "next/server";
import { handle, requireUserId } from "@/lib/api";
import { toggleJobApplied } from "@/lib/jobs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const applied = await toggleJobApplied(userId, jobPostingId);
    return NextResponse.json({ applied });
  });
}
