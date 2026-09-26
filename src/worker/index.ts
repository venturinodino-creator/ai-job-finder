import "dotenv/config";
import cron from "node-cron";
import { runIngest } from "@/agents/ingest";
import { runDigestAll } from "@/agents/digest";

// Self-hosted scheduler: `npm run worker` (or the `worker` service in
// docker-compose.yml) runs this process alongside the Next.js app.
//
// If you deploy on a platform with managed cron instead (Vercel Cron, a
// Kubernetes CronJob, GitHub Actions schedule...), point it at
// POST /api/cron/ingest and POST /api/cron/digest instead of running this
// file — see BUILD_SPEC.md "Agent schedule".
//
// Times are UTC. Digest runs after ingest so the day's feed is fresh.
const INGEST_CRON = "0 5 * * *"; // 05:00 UTC
const DIGEST_CRON = "30 6 * * *"; // 06:30 UTC

async function ingestJob() {
  console.log(`[worker] ${new Date().toISOString()} running ingest...`);
  try {
    const summaries = await runIngest();
    console.log("[worker] ingest done:", summaries);
  } catch (err) {
    console.error("[worker] ingest failed:", err);
  }
}

async function digestJob() {
  console.log(`[worker] ${new Date().toISOString()} running digest...`);
  try {
    const results = await runDigestAll();
    console.log(`[worker] digest done for ${results.length} user(s).`);
  } catch (err) {
    console.error("[worker] digest failed:", err);
  }
}

cron.schedule(INGEST_CRON, ingestJob);
cron.schedule(DIGEST_CRON, digestJob);

console.log(`[worker] scheduled ingest (${INGEST_CRON}) and digest (${DIGEST_CRON}). Waiting...`);

// Run once immediately on boot so a fresh self-host isn't empty until the
// next scheduled tick.
void ingestJob().then(() => digestJob());
