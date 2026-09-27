import { NextResponse } from "next/server";
import { handle, requireUserId } from "@/lib/api";
import { runDigestForUser } from "@/agents/digest";

// Lets a logged-in user pull a fresh match run on demand, instead of waiting
// for the nightly schedule (src/worker/index.ts). Scoped to their own
// profiles — no CRON_SECRET needed since it's the user acting on their own data.

// Scoring shortlists up to 500 postings through the LLM; a run takes a couple
// of minutes, so give it the same headroom as the cron routes.
export const maxDuration = 300;

export async function POST() {
  return handle(async () => {
    const userId = await requireUserId();
    const digest = await runDigestForUser(userId);
    return NextResponse.json({ digest });
  });
}
