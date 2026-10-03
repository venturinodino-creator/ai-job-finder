import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runIngest } from "@/agents/ingest";

const INGEST_BUDGET_MS = 240_000;

// Alternative to `npm run worker` for platforms with managed HTTP cron.
// Vercel Cron (see vercel.json) sends a GET request with an
// `Authorization: Bearer <CRON_SECRET>` header it fills in automatically
// from the project's CRON_SECRET env var — POST is also accepted for a
// Kubernetes CronJob, GitHub Actions, or a manual curl.
async function handle(req: NextRequest) {
  const env = getEnv();
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // The function may run for 300s (maxDuration below). Stop starting sources
  // at 240s so the ones in flight can finish; the rest are the stalest next time.
  const summaries = await runIngest(undefined, { budgetMs: INGEST_BUDGET_MS });
  return NextResponse.json({ summaries, deferred: summaries.filter((s) => s.deferred).length });
}

export const GET = handle;
export const POST = handle;
export const maxDuration = 300;
