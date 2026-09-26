import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runIngest } from "@/agents/ingest";

// Alternative to `npm run worker` for platforms with managed HTTP cron
// (Vercel Cron, a Kubernetes CronJob hitting this URL, GitHub Actions...).
// Requires `Authorization: Bearer <CRON_SECRET>`.
export async function POST(req: NextRequest) {
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
