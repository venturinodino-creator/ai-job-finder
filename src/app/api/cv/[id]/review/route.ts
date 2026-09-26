import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { reviewCv } from "@/agents/cvReview";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const cv = await db.cv.findUnique({ where: { id } });
    if (!cv || cv.userId !== userId) throw new ApiError(404, "CV not found");

    const review = await reviewCv(id);
    return NextResponse.json({ review });
  });
}
