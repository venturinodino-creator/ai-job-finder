import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/support/testDatabase.mjs";

// Database-backed tests share one disposable database, so test files run one
// at a time; the suite is small enough that this costs nothing noticeable.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/support/globalSetup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: testDatabaseUrl() ?? "",
      JWT_SECRET: process.env.JWT_SECRET || "test-only-secret",
    },
  },
});
