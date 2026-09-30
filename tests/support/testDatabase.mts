// Where database-backed tests run. Derived from TEST_DATABASE_URL, or from
// DATABASE_URL with the database name suffixed "_test", so the suite can
// truncate and seed freely without touching development data. Only local
// hosts are accepted: a misconfigured environment must never point the
// suite at production.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db", "postgres"]);

export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const base = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!base) return null;

  const url = new URL(base);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing to run database tests against "${url.hostname}": tests only run against a local Postgres. ` +
        "Set TEST_DATABASE_URL to a local database.",
    );
  }
  if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}
