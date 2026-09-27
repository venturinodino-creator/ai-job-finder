import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUserId } from "@/lib/api";
import { sendApplication } from "@/lib/applications";

const bodySchema = z.object({ method: z.enum(["EMAIL", "MANUAL"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id: jobPostingId } = await params;
    const { method } = bodySchema.parse(await req.json());
    const application = await sendApplication(userId, jobPostingId, method);
    return NextResponse.json({ application });
  });
}
