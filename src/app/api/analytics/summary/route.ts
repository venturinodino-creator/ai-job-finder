import { NextResponse } from "next/server";
import { handle, requireUserId } from "@/lib/api";
import { getAnalyticsSummary } from "@/lib/analytics";

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const summary = await getAnalyticsSummary(userId);
    return NextResponse.json(summary);
  });
}
