import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { check, consume, release, usageSummary } from "@/lib/entitlements";
import { resetDatabase, seedUser } from "../support/seed";

// What a Free user may do, and what they are told when they may not. These
// tests read only what the module returns and what the usage rows say; the
// allowance numbers themselves live in one configuration place.

const DAY = 86_400_000;
const T0 = new Date("2026-10-03T12:00:00Z");

describe("scoring allowance on the Free plan", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("lets a user run once, and records the use", async () => {
    const user = await seedUser();

    const outcome = await consume(user.id, "SCORING_RUN", T0);

    expect(outcome.allowed).toBe(true);
    expect(await db.usageRecord.count({ where: { userId: user.id, action: "SCORING_RUN" } })).toBe(1);
  });

  it("refuses a second run inside seven days, saying what was used and when the next opens", async () => {
    const user = await seedUser();
    await consume(user.id, "SCORING_RUN", T0);

    const outcome = await consume(user.id, "SCORING_RUN", new Date(T0.getTime() + 2 * DAY));

    expect(outcome.allowed).toBe(false);
    if (outcome.allowed) return;
    expect(outcome).toMatchObject({ action: "SCORING_RUN", used: 1, limit: 1 });
    expect(outcome.resetsAt.toISOString()).toBe(new Date(T0.getTime() + 7 * DAY).toISOString());
    expect(outcome.message).toMatch(/scoring run/i);
    expect(outcome.message).toMatch(/Upgrade to Pro/);
    // A refusal spends nothing.
    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(1);
  });

  it("opens again exactly seven days after the run, not a moment sooner", async () => {
    const user = await seedUser();
    await consume(user.id, "SCORING_RUN", T0);

    const justBefore = await check(user.id, "SCORING_RUN", new Date(T0.getTime() + 7 * DAY - 1));
    const atReset = await check(user.id, "SCORING_RUN", new Date(T0.getTime() + 7 * DAY));

    expect(justBefore.allowed).toBe(false);
    expect(atReset.allowed).toBe(true);
  });

  it("counts each user on their own", async () => {
    const [a, b] = [await seedUser(), await seedUser()];
    await consume(a.id, "SCORING_RUN", T0);

    expect((await consume(b.id, "SCORING_RUN", T0)).allowed).toBe(true);
  });

  it("lets only one of two simultaneous requests have the last unit", async () => {
    const user = await seedUser();

    const outcomes = await Promise.all([consume(user.id, "SCORING_RUN", T0), consume(user.id, "SCORING_RUN", T0), consume(user.id, "SCORING_RUN", T0)]);

    expect(outcomes.filter((o) => o.allowed)).toHaveLength(1);
    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(1);
  });

  it("gives the unit back when the run it paid for failed", async () => {
    const user = await seedUser();
    const outcome = await consume(user.id, "SCORING_RUN", T0);
    if (!outcome.allowed) throw new Error("expected the first run to be allowed");

    await release(outcome.usageId);

    expect((await consume(user.id, "SCORING_RUN", T0)).allowed).toBe(true);
  });

  it("releasing a unit that is already gone is harmless", async () => {
    const user = await seedUser();
    const outcome = await consume(user.id, "SCORING_RUN", T0);
    if (!outcome.allowed) throw new Error("expected the first run to be allowed");
    await release(outcome.usageId);

    await expect(release(outcome.usageId)).resolves.toBeUndefined();
  });

  it("peeking spends nothing", async () => {
    const user = await seedUser();

    expect((await check(user.id, "SCORING_RUN", T0)).allowed).toBe(true);
    expect((await check(user.id, "SCORING_RUN", T0)).allowed).toBe(true);
    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("the usage summary", () => {
  beforeEach(resetDatabase);

  it("shows the scoring allowance as unused for a user who has not run", async () => {
    const user = await seedUser();

    const summary = await usageSummary(user.id, T0);

    const scoring = summary.find((s) => s.action === "SCORING_RUN");
    expect(scoring).toMatchObject({ used: 0, limit: 1, resetsAt: null });
  });

  it("shows when the spent allowance opens again", async () => {
    const user = await seedUser();
    await consume(user.id, "SCORING_RUN", T0);

    const scoring = (await usageSummary(user.id, new Date(T0.getTime() + DAY))).find((s) => s.action === "SCORING_RUN");

    expect(scoring).toMatchObject({ used: 1, limit: 1 });
    expect(scoring?.resetsAt?.toISOString()).toBe(new Date(T0.getTime() + 7 * DAY).toISOString());
  });

  it("names the plan the allowances belong to", async () => {
    const user = await seedUser();
    const summary = await usageSummary(user.id, T0);
    expect(summary.every((s) => s.plan === "FREE")).toBe(true);
  });
});
