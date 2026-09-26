import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { tailorCvForJob } from "@/agents/cvTailor";

const bodySchema = z.object({ cvId: z.string() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const { cvId } = bodySchema.parse(await req.json());

    const [cv, job] = await Promise.all([
      db.cv.findUnique({ where: { id: cvId } }),
      db.jobPosting.findUnique({ where: { id: jobPostingId } }),
    ]);
    if (!cv || cv.userId !== userId) throw new ApiError(404, "CV not found");
    if (!job) throw new ApiError(404, "Job posting not found");

    const tailored = await tailorCvForJob(cvId, jobPostingId);
    return NextResponse.json({ tailored });
  });
}
