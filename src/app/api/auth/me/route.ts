import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ user: null });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json({ user });
}
