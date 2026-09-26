import "dotenv/config";
import { db } from "@/lib/db";
import { jobSourceAdapters } from "@/agents/sources";
import { ACHIEVEMENTS } from "@/lib/achievements";

// Registers the configured job sources and the achievement catalog so both
// show up immediately, even before the first ingest run or unlock. Safe to
// re-run — achievements are also lazily upserted the first time they're
// unlocked (see src/lib/gamification.ts), this just seeds them up front.
async function main() {
  for (const adapter of jobSourceAdapters) {
    await db.jobSource.upsert({
      where: { key: adapter.key },
      create: { key: adapter.key, name: adapter.name, baseUrl: adapter.baseUrl, kind: "PUBLIC_API" },
      update: { name: adapter.name, baseUrl: adapter.baseUrl },
    });
    console.log(`Registered job source: ${adapter.name}`);
  }

  for (const achievement of ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { key: achievement.key },
      create: {
        key: achievement.key,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        points: achievement.points,
        sortOrder: achievement.sortOrder,
      },
      update: {
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        points: achievement.points,
        sortOrder: achievement.sortOrder,
      },
    });
    console.log(`Registered achievement: ${achievement.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
