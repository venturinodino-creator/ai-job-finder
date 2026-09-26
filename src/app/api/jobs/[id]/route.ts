import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;

    const job = await db.jobPosting.findUnique({
      where: { id },
      include: {
        source: true,
        matches: { where: { profile: { userId } }, include: { profile: true } },
        tailoredCvs: { where: { cv: { userId } } },
      },
    });
    if (!job) throw new ApiError(404, "Job posting not found");

    return NextResponse.json({ job });
  });
}
