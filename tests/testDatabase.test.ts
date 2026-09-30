import { describe, expect, it } from "vitest";
import { databaseName, testDatabaseUrl } from "./support/testDatabase.mjs";

describe("testDatabaseUrl", () => {
  it("derives a sibling _test database from the local development URL", () => {
    expect(testDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5433/jobfinder?schema=public" })).toBe(
      "postgresql://u:p@localhost:5433/jobfinder_test?schema=public",
    );
  });

  it("leaves a URL alone that already names a _test database", () => {
    expect(testDatabaseUrl({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/jobfinder_test" })).toBe(
      "postgresql://u:p@127.0.0.1:5432/jobfinder_test",
    );
  });

  it("prefers TEST_DATABASE_URL when set", () => {
    expect(
      testDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5433/jobfinder", TEST_DATABASE_URL: "postgresql://u:p@localhost:5432/other" }),
    ).toBe("postgresql://u:p@localhost:5432/other_test");
  });

  it("refuses any host that is not local, so a stray production URL can never be used", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: "postgresql://u:p@ep-cool-name.eu-central-1.aws.neon.tech/neondb" })).toThrow(
      /Refusing to run database tests/,
    );
  });

  it("is null when nothing is configured", () => {
    expect(testDatabaseUrl({})).toBeNull();
  });

  it("reads the database name back out of a URL", () => {
    expect(databaseName("postgresql://u:p@localhost:5433/jobfinder_test?schema=public")).toBe("jobfinder_test");
  });
});
