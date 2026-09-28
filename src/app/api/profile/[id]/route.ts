import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { describeSnapshot, profileSnapshot, snapshotsDiffer } from "@/lib/profileSnapshot";
import { recordSearch } from "@/lib/searchHistory";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  targetRoles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  remotePref: z.enum(["REMOTE", "HYBRID", "ON_SITE", "ANY"]).optional(),
  seniority: z
    .enum(["INTERN", "JUNIOR", "MID", "SENIOR", "STAFF", "PRINCIPAL", "MANAGER", "DIRECTOR", "EXECUTIVE"])
    .nullable()
    .optional(),
  salaryMin: z.number().int().nullable().optional(),
  salaryMax: z.number().int().nullable().optional(),
  salaryCurrency: z.string().nullable().optional(),
  expectsCommission: z.boolean().optional(),
  industries: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  activeCvId: z.string().nullable().optional(),
});

async function assertOwnership(profileId: string, userId: string) {
  const profile = await db.searchProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.userId !== userId) throw new ApiError(404, "Search profile not found");
  return profile;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await assertOwnership(id, userId);
    const body = updateSchema.parse(await req.json());
    const before = await db.searchProfile.findUniqueOrThrow({ where: { id } });
    const profile = await db.searchProfile.update({ where: { id }, data: body });

    // A change to anything the match agent looks at (roles, locations,
    // remote preference, seniority, salary, industries, languages, CV) makes
    // the current scores stale. Drop the ones the user hasn't acted on, log
    // the new criteria in the archive, and tell the client to re-score so
    // the feed reflects the new search without a manual refresh.
    const rescore = snapshotsDiffer(profileSnapshot(before), profileSnapshot(profile));
    if (rescore) {
      const snapshot = profileSnapshot(profile);
      await db.matchScore.deleteMany({ where: { profileId: id, appliedAt: null } });
      await recordSearch(userId, "PROFILE_CHANGE", describeSnapshot(snapshot), { ...snapshot });
    }

    return NextResponse.json({ profile, rescore });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    await assertOwnership(id, userId);
    await db.searchProfile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
