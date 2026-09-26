import { NextResponse } from "next/server";
import { handle, requireUserId } from "@/lib/api";
import { getGamificationSummary } from "@/lib/gamification";

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const summary = await getGamificationSummary(userId);
    return NextResponse.json(summary);
  });
}
