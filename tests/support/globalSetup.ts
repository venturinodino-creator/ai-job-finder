import { execSync } from "node:child_process";
import pg from "pg";
import { databaseName, testDatabaseUrl } from "./testDatabase.mjs";

// Runs once before the suite: makes sure the disposable test database exists
// and carries every migration. If no local Postgres is reachable the pure
// tests still run; the database-backed ones fail on their own with a clear
// connection error.
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!url) {
    console.warn("[tests] DATABASE_URL is not set; database-backed tests will fail.");
    return;
  }

  const name = databaseName(url);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (err) {
    console.warn(`[tests] No Postgres at ${admin.host}; database-backed tests will fail. (${(err as Error).message})`);
    return;
  }
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  });
}
