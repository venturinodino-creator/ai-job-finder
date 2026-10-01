import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createSearchProfile, updateSearchProfile } from "@/lib/searchProfile";
import { searchState } from "@/lib/searchState";
import { resetDatabase, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedUser } from "../support/seed";

// The Search profile module owns saving a search. Changing anything the
// matcher looks at replaces the search: the old one is filed in the Archive
// with its matches, scores the user has not acted on go, applied ones stay.
// These tests look at what the calls return and what is in the database
// afterwards.

describe("search profile", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  async function seedSearchWithMatches() {
    const user = await seedUser();
    const profile = await seedProfile(user.id, { targetRoles: ["Account Manager"], locations: ["Cape Town"] });
    const source = await seedSource();
    const [applied, viewed, untouched] = await Promise.all([seedPosting(source.id), seedPosting(source.id), seedPosting(source.id)]);
    await seedMatch(profile.id, applied.id, { score: 80, appliedAt: new Date(), viewedAt: new Date() });
    await seedMatch(profile.id, viewed.id, { score: 70, viewedAt: new Date() });
    await seedMatch(profile.id, untouched.id, { score: 40 });
    return { user, profile, applied, viewed, untouched };
  }
  const archive = (userId: string) => db.searchHistory.findMany({ where: { userId, kind: "PROFILE_CHANGE" } });
  const scoredPostings = async (profileId: string) => (await db.matchScore.findMany({ where: { profileId } })).map((m) => m.jobPostingId);

  describe("changing the search", () => {
    it("archives the search being replaced with its matches, drops unacted scores, keeps applied ones and asks for a re-score", async () => {
      const { user, profile, applied } = await seedSearchWithMatches();

      const result = await updateSearchProfile(user.id, profile.id, { targetRoles: ["Channel Manager"] });

      expect(result.rescore).toBe(true);
      expect(result.profile.targetRoles).toEqual(["Channel Manager"]);
      const entries = await archive(user.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ resultCount: 3, params: { targetRoles: ["Account Manager"], locations: ["Cape Town"] } });
      expect(entries[0].label).toContain("Account Manager");
      expect(await scoredPostings(profile.id)).toEqual([applied.id]);
    });

    it("leaves the pipeline's Applied count unchanged across a search change", async () => {
      const { user, profile } = await seedSearchWithMatches();
      const before = (await searchState(user.id)).pipeline.applied;

      await updateSearchProfile(user.id, profile.id, { locations: ["Netherlands"] });

      expect((await searchState(user.id)).pipeline.applied).toBe(before);
    });

    it("treats attaching a different CV as a new search", async () => {
      const { user, profile } = await seedSearchWithMatches();
      const cv = await seedCv(user.id);

      const result = await updateSearchProfile(user.id, profile.id, { activeCvId: cv.id });

      expect(result.rescore).toBe(true);
      expect(await archive(user.id)).toHaveLength(1);
    });

    it("does nothing but save when nothing the matcher looks at changed", async () => {
      const { user, profile } = await seedSearchWithMatches();

      const result = await updateSearchProfile(user.id, profile.id, { targetRoles: ["  Account Manager "], locations: ["Cape Town"], name: "Renamed" });

      expect(result.rescore).toBe(false);
      expect(result.profile.name).toBe("Renamed");
      expect(await archive(user.id)).toHaveLength(0);
      expect(await scoredPostings(profile.id)).toHaveLength(3);
    });

    it("refuses a save that would leave the search without a target role, and changes nothing", async () => {
      const { user, profile } = await seedSearchWithMatches();

      await expect(updateSearchProfile(user.id, profile.id, { targetRoles: [" ", ""], locations: ["Berlin"] })).rejects.toMatchObject({ status: 400 });

      const unchanged = await db.searchProfile.findUniqueOrThrow({ where: { id: profile.id } });
      expect(unchanged).toMatchObject({ targetRoles: ["Account Manager"], locations: ["Cape Town"] });
      expect(await scoredPostings(profile.id)).toHaveLength(3);
      expect(await archive(user.id)).toHaveLength(0);
    });

    it("allows a change that does not touch the roles at all", async () => {
      const { user, profile } = await seedSearchWithMatches();
      await expect(updateSearchProfile(user.id, profile.id, { remotePref: "ON_SITE" })).resolves.toMatchObject({ rescore: true });
    });

    it("refuses another user's profile, and one that does not exist", async () => {
      const { profile } = await seedSearchWithMatches();
      const stranger = await seedUser();

      await expect(updateSearchProfile(stranger.id, profile.id, { targetRoles: ["Hijacked"] })).rejects.toMatchObject({ status: 404 });
      await expect(updateSearchProfile(stranger.id, "no-such-profile", { targetRoles: ["X"] })).rejects.toMatchObject({ status: 404 });
      expect((await db.searchProfile.findUniqueOrThrow({ where: { id: profile.id } })).targetRoles).toEqual(["Account Manager"]);
    });
  });

  describe("creating the first search", () => {
    it("creates the profile, asks for a re-score and records the activity once", async () => {
      const user = await seedUser();

      const first = await createSearchProfile(user.id, { targetRoles: ["Account Manager"], locations: ["Cape Town"] });
      await createSearchProfile(user.id, { targetRoles: ["Channel Manager"] });

      expect(first.rescore).toBe(true);
      expect(first.profile).toMatchObject({ userId: user.id, targetRoles: ["Account Manager"], remotePref: "ANY", isActive: true });
      expect(await db.activityEvent.count({ where: { userId: user.id, type: "PROFILE_CREATED" } })).toBe(1);
    });

    it("refuses a profile with no target role", async () => {
      const user = await seedUser();

      await expect(createSearchProfile(user.id, { targetRoles: [] })).rejects.toMatchObject({ status: 400 });
      expect(await db.searchProfile.count({ where: { userId: user.id } })).toBe(0);
    });
  });
});
