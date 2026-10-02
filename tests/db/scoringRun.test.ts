import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { SCORING_RUN_TIMEOUT_MS, claimScoringRun, releaseScoringRun, withScoringRun } from "@/lib/scoringRun";
import { searchState } from "@/lib/searchState";
import { resetDatabase, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedUser } from "../support/seed";

// A scoring run takes a minute or two and writes its scores at the end. The
// search records when a run started so every page can tell "scoring right
// now" from "nothing scored", and so a second run cannot start meanwhile.
// These tests look at what the calls return and what the Search state module
// reports.

describe("scoring run", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  async function seedReadySearch() {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id });
    return { user, profile };
  }

  describe("claiming a run", () => {
    it("lets the first claim through and refuses a second while the run is in flight", async () => {
      const { profile } = await seedReadySearch();

      expect(await claimScoringRun(profile.id)).toBe(true);
      expect(await claimScoringRun(profile.id)).toBe(false);
    });

    it("lets a new run start once the last one was released", async () => {
      const { profile } = await seedReadySearch();
      await claimScoringRun(profile.id);

      await releaseScoringRun(profile.id);

      expect(await claimScoringRun(profile.id)).toBe(true);
    });

    it("frees a search whose run died, after the timeout", async () => {
      const { profile } = await seedReadySearch();
      await db.searchProfile.update({ where: { id: profile.id }, data: { scoringStartedAt: new Date(Date.now() - SCORING_RUN_TIMEOUT_MS - 1000) } });

      expect(await claimScoringRun(profile.id)).toBe(true);
    });

    it("does not free a run that is merely slow", async () => {
      const { profile } = await seedReadySearch();
      await db.searchProfile.update({ where: { id: profile.id }, data: { scoringStartedAt: new Date(Date.now() - SCORING_RUN_TIMEOUT_MS + 60_000) } });

      expect(await claimScoringRun(profile.id)).toBe(false);
    });

    it("lets only one of two simultaneous claims through", async () => {
      const { profile } = await seedReadySearch();

      const results = await Promise.all([claimScoringRun(profile.id), claimScoringRun(profile.id)]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("claims per search: another search is unaffected", async () => {
      const { user, profile } = await seedReadySearch();
      const other = await seedProfile(user.id, { isActive: false });
      await claimScoringRun(profile.id);

      expect(await claimScoringRun(other.id)).toBe(true);
    });
  });

  describe("withScoringRun", () => {
    it("runs the work while the search reads as scoring, and releases it afterwards", async () => {
      const { user, profile } = await seedReadySearch();
      let during: boolean | undefined;

      const outcome = await withScoringRun(profile.id, async () => {
        during = (await searchState(user.id)).scoring.running;
        return 42;
      });

      expect(outcome).toEqual({ ran: true, value: 42 });
      expect(during).toBe(true);
      expect((await searchState(user.id)).scoring.running).toBe(false);
    });

    it("releases the search when the work fails, and passes the failure on", async () => {
      const { user, profile } = await seedReadySearch();

      await expect(
        withScoringRun(profile.id, async () => {
          throw new Error("model unavailable");
        }),
      ).rejects.toThrow("model unavailable");

      expect((await searchState(user.id)).scoring.running).toBe(false);
      expect(await claimScoringRun(profile.id)).toBe(true);
    });

    it("does not run the work when a run is already in flight", async () => {
      const { profile } = await seedReadySearch();
      await claimScoringRun(profile.id);
      let calls = 0;

      const outcome = await withScoringRun(profile.id, async () => {
        calls += 1;
      });

      expect(outcome).toEqual({ ran: false });
      expect(calls).toBe(0);
    });
  });

  describe("what the pages read", () => {
    it("reports no run for a search that never scored, and for a user with no search", async () => {
      const { user } = await seedReadySearch();
      expect((await searchState(user.id)).scoring).toEqual({ running: false, startedAt: null });

      const nobody = await seedUser();
      expect((await searchState(nobody.id)).scoring).toEqual({ running: false, startedAt: null });
    });

    it("reports a run in flight with when it started", async () => {
      const { user, profile } = await seedReadySearch();
      const startedAt = new Date(Date.now() - 30_000);
      await db.searchProfile.update({ where: { id: profile.id }, data: { scoringStartedAt: startedAt } });

      const { scoring } = await searchState(user.id);

      expect(scoring.running).toBe(true);
      expect(scoring.startedAt?.toISOString()).toBe(startedAt.toISOString());
    });

    it("stops reporting a run that outlived the timeout", async () => {
      const { user, profile } = await seedReadySearch();
      await db.searchProfile.update({ where: { id: profile.id }, data: { scoringStartedAt: new Date(Date.now() - SCORING_RUN_TIMEOUT_MS - 1000) } });

      expect((await searchState(user.id)).scoring.running).toBe(false);
    });

    it("keeps reporting the run while old scores are still on screen", async () => {
      const { user, profile } = await seedReadySearch();
      const posting = await seedPosting((await seedSource()).id);
      await seedMatch(profile.id, posting.id, { score: 70 });
      await claimScoringRun(profile.id);

      const state = await searchState(user.id);

      expect(state.scoring.running).toBe(true);
      expect(state.pipeline.scored).toBe(1);
    });
  });
});
