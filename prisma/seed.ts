import "dotenv/config";
import { db } from "@/lib/db";
import { jobSourceAdapters } from "@/agents/sources";

// Registers the configured job sources so they show up immediately, even
// before the first ingest run. Safe to re-run.
async function main() {
  for (const adapter of jobSourceAdapters) {
    await db.jobSource.upsert({
      where: { key: adapter.key },
      create: { key: adapter.key, name: adapter.name, baseUrl: adapter.baseUrl, kind: "PUBLIC_API" },
      update: { name: adapter.name, baseUrl: adapter.baseUrl },
    });
    console.log(`Registered job source: ${adapter.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
