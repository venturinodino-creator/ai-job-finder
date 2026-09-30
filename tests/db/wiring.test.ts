import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

// Proves the test suite can reach a real Postgres through the application's
// own client, with the migrations applied. Every database-backed suite that
// follows relies on exactly this wiring.
describe("database wiring", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("runs against a disposable test database, never the development or production one", () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    expect(url.pathname).toMatch(/_test$/);
    expect(["localhost", "127.0.0.1", "db", "postgres"]).toContain(url.hostname);
  });

  it("writes a row and reads it back through the application's client", async () => {
    const email = `wiring-${Date.now()}@example.test`;
    const created = await db.user.create({ data: { email, passwordHash: "not-a-real-hash" } });

    const found = await db.user.findUnique({ where: { email } });

    expect(found?.id).toBe(created.id);
    // A column default only exists if the migrations ran against this database.
    expect(found?.timezone).toBe("UTC");

    await db.user.delete({ where: { id: created.id } });
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });
});
