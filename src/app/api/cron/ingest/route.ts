import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runIngest } from "@/agents/ingest";

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

  const summaries = await runIngest();
  return NextResponse.json({ summaries });
}

export const GET = handle;
export const POST = handle;
export const maxDuration = 300;
