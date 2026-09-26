import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const userId = await requireUserId();
    const profileId = req.nextUrl.searchParams.get("profileId");

    const profile = profileId
      ? await db.searchProfile.findUnique({ where: { id: profileId } })
      : await db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });

    if (!profile || profile.userId !== userId) {
      throw new ApiError(404, "Search profile not found. Create one first.");
    }

    const matches = await db.matchScore.findMany({
      where: { profileId: profile.id },
      orderBy: [{ isWildcard: "asc" }, { score: "desc" }],
      include: { jobPosting: { include: { source: true } } },
    });

    return NextResponse.json({ profile, matches });
  });
}
