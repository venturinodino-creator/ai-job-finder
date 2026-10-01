import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { postingState, searchState } from "@/lib/searchState";
import { resetDatabase, seedApplication, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedTailoredCv, seedUser } from "../support/seed";

// The per-posting reading of the Search state module: for one user and one
// posting, what the current search says about it and how far the user has
// taken it, under the same rules as the pipeline. Tested through what it
// returns.

describe("postingState", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  async function seedSearch() {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id });
    const source = await seedSource();
    const posting = await seedPosting(source.id, { title: "Account Manager", company: "Acme" });
    return { user, cv, profile, source, posting };
  }

  it("is null for a posting that does not exist", async () => {
    const user = await seedUser();
    expect(await postingState(user.id, "no-such-posting")).toBeNull();
  });

  it("returns the reading of a scored posting with its matched and missing skills", async () => {
    const { user, profile, posting } = await seedSearch();
    const scoredAt = new Date("2026-09-30T10:00:00Z");
    await seedMatch(profile.id, posting.id, {
      score: 72,
      createdAt: scoredAt,
      locationMismatch: true,
      matchedSkills: ["Account management", "SaaS"],
      missingSkills: ["German"],
    });

    const state = await postingState(user.id, posting.id);

    expect(state?.posting).toMatchObject({ id: posting.id, title: "Account Manager", source: { name: "Test board" } });
    expect(state?.reading).toMatchObject({
      score: 72,
      isWildcard: false,
      explanation: "Fits.",
      applied: false,
      locationMismatch: true,
      matchedSkills: ["Account management", "SaaS"],
      missingSkills: ["German"],
    });
    expect(state?.reading?.scoredAt.toISOString()).toBe(scoredAt.toISOString());
  });

  it("has no reading for a posting the search has not scored, but still reports its steps", async () => {
    const { user, posting } = await seedSearch();

    const state = await postingState(user.id, posting.id);

    expect(state?.reading).toBeNull();
    expect(state?.steps).toEqual({ opened: false, prepared: false, applied: null });
  });

  it("reads only the active profile's score", async () => {
    const { user, profile, posting } = await seedSearch();
    const old = await seedProfile(user.id, { isActive: false });
    await seedMatch(old.id, posting.id, { score: 95 });
    await seedMatch(profile.id, posting.id, { score: 41 });

    expect((await postingState(user.id, posting.id))?.reading?.score).toBe(41);
  });

  describe("steps", () => {
    it("marks a viewed posting opened and nothing more", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id, { viewedAt: new Date() });

      expect((await postingState(user.id, posting.id))?.steps).toEqual({ opened: true, prepared: false, applied: null });
    });

    it("counts a drafted application as prepared, which implies opened", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id);
      await seedApplication(user.id, posting.id, "DRAFT");

      const state = await postingState(user.id, posting.id);

      expect(state?.steps).toEqual({ opened: true, prepared: true, applied: null });
      expect(state?.application?.status).toBe("DRAFT");
    });

    it("counts a tailored CV as prepared, and reports it only when it belongs to the active CV", async () => {
      const { user, cv, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id);
      const otherCv = await seedCv(user.id);
      await seedTailoredCv(otherCv.id, posting.id);

      const other = await postingState(user.id, posting.id);
      expect(other?.steps.prepared).toBe(true);
      expect(other?.tailored).toBeNull();

      const mine = await seedTailoredCv(cv.id, posting.id);
      const active = await postingState(user.id, posting.id);
      expect(active?.tailored?.id).toBe(mine.id);
    });

    it("reports an emailed application as applied with its method and date", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id);
      const sentAt = new Date("2026-09-29T08:30:00Z");
      await seedApplication(user.id, posting.id, "SENT", { method: "EMAIL", sentAt });

      const state = await postingState(user.id, posting.id);

      expect(state?.steps).toEqual({ opened: true, prepared: true, applied: { method: "EMAIL", at: sentAt } });
      expect(state?.reading?.applied).toBe(true);
    });

    it("reports a posting marked applied on its match row, with no method", async () => {
      const { user, profile, posting } = await seedSearch();
      const appliedAt = new Date("2026-09-28T12:00:00Z");
      await seedMatch(profile.id, posting.id, { appliedAt });

      expect((await postingState(user.id, posting.id))?.steps).toEqual({ opened: true, prepared: true, applied: { method: null, at: appliedAt } });
    });

    it("reports an applied application on an unscored posting", async () => {
      const { user, posting } = await seedSearch();
      const sentAt = new Date("2026-09-29T08:30:00Z");
      await seedApplication(user.id, posting.id, "APPLIED", { method: "MANUAL", sentAt });

      const state = await postingState(user.id, posting.id);

      expect(state?.reading).toBeNull();
      expect(state?.steps.applied).toEqual({ method: "MANUAL", at: sentAt });
    });
  });

  it("agrees with the pipeline's counts for the same search", async () => {
    const { user, cv, profile, source } = await seedSearch();
    const postings = await Promise.all(Array.from({ length: 5 }, () => seedPosting(source.id)));
    await seedMatch(profile.id, postings[0].id, { score: 85, viewedAt: new Date(), appliedAt: new Date() });
    await seedMatch(profile.id, postings[1].id, { score: 75, viewedAt: new Date() });
    await seedTailoredCv(cv.id, postings[1].id);
    await seedMatch(profile.id, postings[2].id, { score: 65 });
    await seedApplication(user.id, postings[2].id, "DRAFT");
    await seedMatch(profile.id, postings[3].id, { score: 62, viewedAt: new Date() });
    await seedApplication(user.id, postings[3].id, "SENT", { method: "EMAIL", sentAt: new Date() });
    await seedMatch(profile.id, postings[4].id, { score: 40 });

    const { pipeline } = await searchState(user.id);
    const states = await Promise.all(postings.map((p) => postingState(user.id, p.id)));

    expect(states.filter((s) => s?.steps.opened).length).toBe(pipeline.opened);
    expect(states.filter((s) => s?.steps.prepared).length).toBe(pipeline.prepared);
    expect(states.filter((s) => s?.steps.applied).length).toBe(pipeline.applied);
  });

  it("never reads another user's score, application or tailored CV", async () => {
    const { user, posting } = await seedSearch();
    const other = await seedUser();
    const otherCv = await seedCv(other.id);
    const otherProfile = await seedProfile(other.id, { activeCvId: otherCv.id });
    await seedMatch(otherProfile.id, posting.id, { score: 99, viewedAt: new Date(), appliedAt: new Date() });
    await seedApplication(other.id, posting.id, "SENT", { method: "EMAIL", sentAt: new Date() });
    await seedTailoredCv(otherCv.id, posting.id);

    const state = await postingState(user.id, posting.id);

    expect(state?.reading).toBeNull();
    expect(state?.application).toBeNull();
    expect(state?.tailored).toBeNull();
    expect(state?.steps).toEqual({ opened: false, prepared: false, applied: null });
  });

  it("works for a user with no profile", async () => {
    const user = await seedUser();
    const source = await seedSource();
    const posting = await seedPosting(source.id);

    const state = await postingState(user.id, posting.id);

    expect(state).toMatchObject({ profile: null, activeCv: null, reading: null, tailored: null });
  });
});
