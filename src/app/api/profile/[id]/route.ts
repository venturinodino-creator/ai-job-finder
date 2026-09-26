import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, requireUserId } from "@/lib/api";

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
    const profile = await db.searchProfile.update({ where: { id }, data: body });
    return NextResponse.json({ profile });
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
