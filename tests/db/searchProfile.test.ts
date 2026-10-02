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

    it("does not replace the search for a reordering or a change of casing", async () => {
      const { user, profile } = await seedSearchWithMatches();

      const result = await updateSearchProfile(user.id, profile.id, { targetRoles: ["account manager"], locations: ["CAPE TOWN"] });

      expect(result.rescore).toBe(false);
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
    it("creates the profile, asks for no re-score (the setup checklist starts the first run) and records the activity once", async () => {
      const user = await seedUser();

      const first = await createSearchProfile(user.id, { targetRoles: ["Account Manager"], locations: ["Cape Town"] });
      await createSearchProfile(user.id, { targetRoles: ["Channel Manager"] });

      expect(first.rescore).toBe(false);
      expect(first.profile).toMatchObject({ userId: user.id, targetRoles: ["Account Manager"], remotePref: "ANY", isActive: true });
      expect(await db.activityEvent.count({ where: { userId: user.id, type: "PROFILE_CREATED" } })).toBe(1);
    });

    it("attaches the most recent parsed CV", async () => {
      const user = await seedUser();
      const older = await seedCv(user.id);
      const newer = await seedCv(user.id);
      await db.cv.update({ where: { id: older.id }, data: { createdAt: new Date(Date.now() - 86_400_000) } });

      const { profile } = await createSearchProfile(user.id, { targetRoles: ["Account Manager"] });

      expect(profile.activeCvId).toBe(newer.id);
    });

    it("skips a CV that is not parsed yet, taking the newest one that is", async () => {
      const user = await seedUser();
      const parsed = await seedCv(user.id);
      const unparsed = await seedCv(user.id, { parsed: false });
      await db.cv.update({ where: { id: parsed.id }, data: { createdAt: new Date(Date.now() - 86_400_000) } });
      expect(unparsed.id).not.toBe(parsed.id);

      const { profile } = await createSearchProfile(user.id, { targetRoles: ["Account Manager"] });

      expect(profile.activeCvId).toBe(parsed.id);
    });

    it("creates the profile without a CV when the user has none, or only an unparsed one", async () => {
      const nobody = await seedUser();
      expect((await createSearchProfile(nobody.id, { targetRoles: ["Account Manager"] })).profile.activeCvId).toBeNull();

      const unparsedOnly = await seedUser();
      await seedCv(unparsedOnly.id, { parsed: false });
      expect((await createSearchProfile(unparsedOnly.id, { targetRoles: ["Account Manager"] })).profile.activeCvId).toBeNull();
    });

    it("reports a profile that exists but has no CV yet, so the checklist can say so", async () => {
      const user = await seedUser();

      await createSearchProfile(user.id, { targetRoles: ["Account Manager"] });

      expect((await searchState(user.id)).setup).toEqual({ cvParsed: false, hasProfile: true, profileWithCv: false, scored: false, complete: false });
    });

    it("keeps a CV the caller chose, and never takes another user's CV", async () => {
      const user = await seedUser();
      const chosen = await seedCv(user.id);
      await seedCv(user.id);
      const stranger = await seedUser();
      await seedCv(stranger.id);

      const { profile } = await createSearchProfile(user.id, { targetRoles: ["Account Manager"], activeCvId: chosen.id });
      expect(profile.activeCvId).toBe(chosen.id);

      const loner = await seedUser();
      expect((await createSearchProfile(loner.id, { targetRoles: ["Account Manager"] })).profile.activeCvId).toBeNull();
    });

    it("lets the Search state module see the first two setup steps done, ready for the first run", async () => {
      const user = await seedUser();
      await seedCv(user.id);

      await createSearchProfile(user.id, { targetRoles: ["Account Manager"] });

      expect((await searchState(user.id)).setup).toEqual({ cvParsed: true, hasProfile: true, profileWithCv: true, scored: false, complete: false });
    });

    it("refuses a profile with no target role", async () => {
      const user = await seedUser();

      await expect(createSearchProfile(user.id, { targetRoles: [] })).rejects.toMatchObject({ status: 400 });
      expect(await db.searchProfile.count({ where: { userId: user.id } })).toBe(0);
    });
  });
});
