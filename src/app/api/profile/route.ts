import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, requireUserId } from "@/lib/api";
import { createSearchProfile } from "@/lib/searchProfile";

const profileSchema = z.object({
  name: z.string().min(1).default("Default search"),
  targetRoles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remotePref: z.enum(["REMOTE", "HYBRID", "ON_SITE", "ANY"]).default("ANY"),
  seniority: z
    .enum(["INTERN", "JUNIOR", "MID", "SENIOR", "STAFF", "PRINCIPAL", "MANAGER", "DIRECTOR", "EXECUTIVE"])
    .nullable()
    .optional(),
  salaryMin: z.number().int().nullable().optional(),
  salaryMax: z.number().int().nullable().optional(),
  salaryCurrency: z.string().nullable().optional(),
  expectsCommission: z.boolean().default(false),
  industries: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  activeCvId: z.string().nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const profiles = await db.searchProfile.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ profiles });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const userId = await requireUserId();
    const body = profileSchema.parse(await req.json());
    // A brand-new profile has no scores yet; the client kicks off a match run.
    return NextResponse.json(await createSearchProfile(userId, body), { status: 201 });
  });
}
