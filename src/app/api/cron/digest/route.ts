import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runDigestAll } from "@/agents/digest";

// See src/app/api/cron/ingest/route.ts — same auth model and GET+POST
// support, run this one after ingestion has finished for the day.
async function handle(req: NextRequest) {
  const env = getEnv();
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await runDigestAll();
  return NextResponse.json({ digestsProcessed: results.length });
}

export const GET = handle;
export const POST = handle;
export const maxDuration = 300;
