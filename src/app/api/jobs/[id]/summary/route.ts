import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { getOrCreateJobSummary } from "@/agents/jobSummary";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUserId();
    const { id } = await params;
    const job = await db.jobPosting.findUnique({ where: { id }, select: { id: true } });
    if (!job) throw new ApiError(404, "Job posting not found");

    const summary = await getOrCreateJobSummary(id);
    return NextResponse.json({ summary });
  });
}
