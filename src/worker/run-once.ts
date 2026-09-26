import "dotenv/config";
import { runIngest } from "@/agents/ingest";
import { runDigestAll } from "@/agents/digest";

async function main() {
  const task = process.argv[2];

  if (task === "ingest") {
    const summaries = await runIngest();
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }

  if (task === "digest") {
    const results = await runDigestAll();
    console.log(`Sent/updated ${results.length} digest(s).`);
    return;
  }

  console.error('Usage: tsx src/worker/run-once.ts <ingest|digest>');
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
