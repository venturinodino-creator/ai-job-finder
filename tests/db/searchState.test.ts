import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { MAX_ATTENTION_FLAGS, STRONG_MATCH_MIN, parseStage, searchState } from "@/lib/searchState";
import { resetDatabase, seedApplication, seedCv, seedMatch, seedPosting, seedProfile, seedReview, seedSource, seedTailoredCv, seedUser } from "../support/seed";

// The Search state module answers, for one user: which profile and CV are
// active, the matches of the current search grouped as the feed shows them,
// and the pipeline counts the Overview will show. These tests only look at
// what it returns.

describe("searchState", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("reports no profile, no CV and an empty search for a brand-new user", async () => {
    const user = await seedUser();

    const state = await searchState(user.id);

    expect(state.profile).toBeNull();
    expect(state.activeCv).toBeNull();
    expect(state.matches).toEqual({ strong: [], wildcards: [], other: [] });
    expect(state.pipeline).toEqual({ scored: 0, strong: 0, opened: 0, prepared: 0, applied: 0 });
    expect(state.lastScoredAt).toBeNull();
  });

  it("returns the active profile without a CV when none is attached", async () => {
    const user = await seedUser();
    const profile = await seedProfile(user.id);

    const state = await searchState(user.id);

    expect(state.profile?.id).toBe(profile.id);
    expect(state.activeCv).toBeNull();
  });

  it("groups matches as strong, wildcards and other, best score first, with the threshold inclusive", async () => {
    const user = await seedUser();
    const profile = await seedProfile(user.id);
    const source = await seedSource();
    const [a, b, c, d, e] = await Promise.all(Array.from({ length: 5 }, () => seedPosting(source.id)));
    await seedMatch(profile.id, a.id, { score: STRONG_MATCH_MIN });
    await seedMatch(profile.id, b.id, { score: 91 });
    await seedMatch(profile.id, c.id, { score: STRONG_MATCH_MIN - 1 });
    await seedMatch(profile.id, d.id, { score: 82, isWildcard: true });
    await seedMatch(profile.id, e.id, { score: 20 });

    const { matches } = await searchState(user.id);

    expect(matches.strong.map((m) => m.jobPostingId)).toEqual([b.id, a.id]);
    expect(matches.other.map((m) => m.jobPostingId)).toEqual([c.id, e.id]);
    expect(matches.wildcards.map((m) => m.jobPostingId)).toEqual([d.id]);
    expect(matches.strong[0].jobPosting.source.name).toBe("Test board");
  });

  it("counts the pipeline: scored, strong, opened, prepared, applied", async () => {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id });
    const source = await seedSource();
    const [p1, p2, p3, p4, p5, p6] = await Promise.all(Array.from({ length: 6 }, () => seedPosting(source.id)));
    await seedMatch(profile.id, p1.id, { score: 85, viewedAt: new Date(), appliedAt: new Date() }); // applied via mark-as-applied
    await seedMatch(profile.id, p2.id, { score: 75, viewedAt: new Date() }); // opened, then tailored
    await seedTailoredCv(cv.id, p2.id);
    await seedMatch(profile.id, p3.id, { score: 65 }); // drafted an application without opening
    await seedApplication(user.id, p3.id, "DRAFT");
    await seedMatch(profile.id, p4.id, { score: 62, viewedAt: new Date() }); // sent by email
    await seedApplication(user.id, p4.id, "SENT");
    await seedMatch(profile.id, p5.id, { score: 40 }); // scored only
    await seedMatch(profile.id, p6.id, { score: 70, isWildcard: true }); // wildcard: scored, not strong

    const { pipeline } = await searchState(user.id);

    // Later stages imply earlier ones: p1 (applied without a draft) and p3
    // (drafted without opening the page) still count as opened and prepared.
    expect(pipeline).toEqual({ scored: 6, strong: 4, opened: 4, prepared: 4, applied: 2 });
  });

  it("keeps applied roles counted after a profile change removes the unacted rows", async () => {
    const user = await seedUser();
    const profile = await seedProfile(user.id);
    const source = await seedSource();
    const [kept, dropped] = await Promise.all([seedPosting(source.id), seedPosting(source.id)]);
    await seedMatch(profile.id, kept.id, { score: 80, appliedAt: new Date() });
    await seedMatch(profile.id, dropped.id, { score: 80 });
    // What the profile-change route does: unacted scores go, applied ones stay.
    await db.matchScore.deleteMany({ where: { profileId: profile.id, appliedAt: null } });

    const { pipeline } = await searchState(user.id);

    expect(pipeline.applied).toBe(1);
    expect(pipeline.scored).toBe(1);
  });

  it("only counts the active profile's search", async () => {
    const user = await seedUser();
    const source = await seedSource();
    const posting = await seedPosting(source.id);
    const old = await seedProfile(user.id, { isActive: false });
    const active = await seedProfile(user.id);
    await seedMatch(old.id, posting.id, { score: 95 });
    await seedMatch(active.id, posting.id, { score: 30 });

    const state = await searchState(user.id);

    expect(state.profile?.id).toBe(active.id);
    expect(state.pipeline).toMatchObject({ scored: 1, strong: 0 });
  });

  it("buckets the non-wildcard scores for the distribution and reports when the run happened", async () => {
    const user = await seedUser();
    const profile = await seedProfile(user.id);
    const source = await seedSource();
    const [a, b, c] = await Promise.all(Array.from({ length: 3 }, () => seedPosting(source.id)));
    const earlier = new Date("2026-09-29T10:00:00Z");
    const later = new Date("2026-09-30T10:00:00Z");
    await seedMatch(profile.id, a.id, { score: 100, createdAt: earlier });
    await seedMatch(profile.id, b.id, { score: 64, createdAt: later });
    await seedMatch(profile.id, c.id, { score: 64, isWildcard: true, createdAt: later });

    const state = await searchState(user.id);

    expect(state.distribution).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 1]);
    expect(state.lastScoredAt?.toISOString()).toBe(later.toISOString());
  });

  describe("stage filter", () => {
    async function seedFunnel() {
      const user = await seedUser();
      const cv = await seedCv(user.id);
      const profile = await seedProfile(user.id, { activeCvId: cv.id });
      const source = await seedSource();
      const [p1, p2, p3, p4, p5, p6] = await Promise.all(Array.from({ length: 6 }, () => seedPosting(source.id)));
      await seedMatch(profile.id, p1.id, { score: 85, viewedAt: new Date(), appliedAt: new Date() });
      await seedMatch(profile.id, p2.id, { score: 75, viewedAt: new Date() });
      await seedTailoredCv(cv.id, p2.id);
      await seedMatch(profile.id, p3.id, { score: 65 });
      await seedApplication(user.id, p3.id, "DRAFT");
      await seedMatch(profile.id, p4.id, { score: 62, viewedAt: new Date() });
      await seedApplication(user.id, p4.id, "SENT");
      await seedMatch(profile.id, p5.id, { score: 40 });
      await seedMatch(profile.id, p6.id, { score: 70, isWildcard: true });
      return user;
    }
    const listed = (m: { strong: unknown[]; wildcards: unknown[]; other: unknown[] }) => m.strong.length + m.wildcards.length + m.other.length;

    it("narrows the matches to one stage while the pipeline still counts the whole search", async () => {
      const user = await seedFunnel();

      const opened = await searchState(user.id, { stage: "opened" });
      const applied = await searchState(user.id, { stage: "applied" });
      const prepared = await searchState(user.id, { stage: "prepared" });

      expect(opened.stage).toBe("opened");
      expect(listed(opened.matches)).toBe(opened.pipeline.opened);
      expect(listed(applied.matches)).toBe(applied.pipeline.applied);
      expect(listed(prepared.matches)).toBe(prepared.pipeline.prepared);
      expect(opened.pipeline).toEqual({ scored: 6, strong: 4, opened: 4, prepared: 4, applied: 2 });
    });

    it("lists only the strong matches for the strong stage, and everything for scored", async () => {
      const user = await seedFunnel();

      const strong = await searchState(user.id, { stage: "strong" });
      const scored = await searchState(user.id, { stage: "scored" });

      expect(strong.matches.strong).toHaveLength(4);
      expect(strong.matches.wildcards).toHaveLength(0);
      expect(strong.matches.other).toHaveLength(0);
      expect(listed(scored.matches)).toBe(6);
      expect(scored.stage).toBe("scored");
    });

    it("shows the unfiltered search when no stage or an unknown one is asked for", async () => {
      const user = await seedFunnel();

      const none = await searchState(user.id);
      const unknown = await searchState(user.id, { stage: parseStage("bogus") });

      expect(none.stage).toBeNull();
      expect(unknown.stage).toBeNull();
      expect(listed(unknown.matches)).toBe(6);
    });

    it("parses a stage from a query value", () => {
      expect(parseStage("applied")).toBe("applied");
      expect(parseStage("APPLIED")).toBeNull();
      expect(parseStage(["opened"])).toBeNull();
      expect(parseStage(undefined)).toBeNull();
    });
  });

  describe("attention flags", () => {
    const kinds = async (userId: string) => (await searchState(userId)).flags.map((f) => f.kind);
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);

    async function seedQuietSearch() {
      // A search with nothing to flag: one strong match, already opened,
      // scored after every posting was ingested, healthy source, clean CV.
      const user = await seedUser();
      const cv = await seedCv(user.id);
      await seedReview(cv.id, { issues: ["LOW"] });
      const profile = await seedProfile(user.id, { activeCvId: cv.id });
      const source = await seedSource();
      const posting = await seedPosting(source.id);
      await seedMatch(profile.id, posting.id, { score: 80, viewedAt: new Date() });
      return { user, cv, profile, source, posting };
    }

    it("reports nothing to attend to for a quiet search", async () => {
      const { user } = await seedQuietSearch();
      expect(await kinds(user.id)).toEqual([]);
    });

    it("flags strong matches the user has not opened, with a link to the strong stage", async () => {
      const { user, profile, source } = await seedQuietSearch();
      const [a, b] = await Promise.all([seedPosting(source.id), seedPosting(source.id)]);
      await seedMatch(profile.id, a.id, { score: 90 });
      await seedMatch(profile.id, b.id, { score: STRONG_MATCH_MIN });

      const { flags } = await searchState(user.id);

      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ kind: "strong-unopened", count: 2, action: { href: "/dashboard/jobs?stage=strong" } });
    });

    it("flags application drafts not yet sent", async () => {
      const { user, profile, source } = await seedQuietSearch();
      const posting = await seedPosting(source.id);
      await seedMatch(profile.id, posting.id, { score: 50, viewedAt: new Date() });
      await seedApplication(user.id, posting.id, "DRAFT");

      const { flags } = await searchState(user.id);

      expect(flags.map((f) => f.kind)).toEqual(["drafts-unsent"]);
      expect(flags[0]).toMatchObject({ count: 1, action: { href: "/dashboard/jobs?stage=prepared" } });
    });

    it("does not flag a draft once it was sent", async () => {
      const { user, profile, source } = await seedQuietSearch();
      const posting = await seedPosting(source.id);
      await seedMatch(profile.id, posting.id, { score: 50, viewedAt: new Date() });
      await seedApplication(user.id, posting.id, "SENT");

      expect(await kinds(user.id)).toEqual([]);
    });

    it("flags high-severity issues on the active CV's latest review only", async () => {
      const { user, cv } = await seedQuietSearch();
      await seedReview(cv.id, { issues: ["HIGH", "HIGH", "MEDIUM"], createdAt: new Date() });

      const { flags } = await searchState(user.id);

      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ kind: "cv-high-issues", count: 2, action: { href: "/dashboard/cv" } });
    });

    it("ignores high-severity issues on an older review or on a CV that is not active", async () => {
      const { user, cv } = await seedQuietSearch();
      await seedReview(cv.id, { issues: ["HIGH"], createdAt: new Date(Date.now() - 2 * 86_400_000) });
      const otherCv = await seedCv(user.id);
      await seedReview(otherCv.id, { issues: ["HIGH"], createdAt: new Date() });

      expect(await kinds(user.id)).toEqual([]);
    });

    it("flags postings ingested since the last scoring run", async () => {
      const { user, source } = await seedQuietSearch();
      await seedPosting(source.id, { fetchedAt: tomorrow });
      await seedPosting(source.id, { fetchedAt: tomorrow });

      const { flags } = await searchState(user.id);

      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ kind: "new-postings", count: 2, action: { href: "/dashboard/jobs" } });
    });

    it("flags a search whose would-be strong matches are all outside the user's locations", async () => {
      const user = await seedUser();
      const profile = await seedProfile(user.id, { locations: ["Cape Town"], remotePref: "ON_SITE" });
      const source = await seedSource();
      const [a, b] = await Promise.all([seedPosting(source.id), seedPosting(source.id)]);
      // 80 before the penalty, 55 after: would have been strong.
      await seedMatch(profile.id, a.id, { score: 55, locationMismatch: true, viewedAt: new Date() });
      // Never strong, penalty or not.
      await seedMatch(profile.id, b.id, { score: 20, locationMismatch: true, viewedAt: new Date() });

      const { flags } = await searchState(user.id);

      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ kind: "location-blocked", count: 1, action: { href: "/dashboard/profile" } });
    });

    it("does not raise the location flag while any strong match exists", async () => {
      const { user, profile, source } = await seedQuietSearch();
      const posting = await seedPosting(source.id);
      await seedMatch(profile.id, posting.id, { score: 55, locationMismatch: true, viewedAt: new Date() });

      expect(await kinds(user.id)).toEqual([]);
    });

    it("flags job sources reporting an error, but not disabled ones", async () => {
      const { user } = await seedQuietSearch();
      await seedSource({ lastError: "HTTP 500" });
      await seedSource({ lastError: "HTTP 500", enabled: false });

      const { flags } = await searchState(user.id);

      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ kind: "source-errors", count: 1, action: { href: "/dashboard#sources" } });
    });

    it("shows at most three flags, most important first", async () => {
      const { user, cv, profile, source } = await seedQuietSearch();
      await seedSource({ lastError: "HTTP 500" }); // 6th
      await seedPosting(source.id, { fetchedAt: tomorrow }); // 4th
      await seedReview(cv.id, { issues: ["HIGH"], createdAt: new Date() }); // 3rd
      const drafted = await seedPosting(source.id, { fetchedAt: yesterday });
      await seedMatch(profile.id, drafted.id, { score: 50, viewedAt: new Date(), createdAt: yesterday });
      await seedApplication(user.id, drafted.id, "DRAFT"); // 2nd
      const unopened = await seedPosting(source.id, { fetchedAt: yesterday });
      await seedMatch(profile.id, unopened.id, { score: 95, createdAt: yesterday }); // 1st

      const { flags } = await searchState(user.id);

      expect(flags).toHaveLength(MAX_ATTENTION_FLAGS);
      expect(flags.map((f) => f.kind)).toEqual(["strong-unopened", "drafts-unsent", "cv-high-issues"]);
    });

    it("has no flags for a user without a profile", async () => {
      const user = await seedUser();
      await seedSource({ lastError: "HTTP 500" });

      expect(await kinds(user.id)).toEqual([]);
    });
  });

  describe("CV health", () => {
    const day = 86_400_000;

    it("is absent for a user with no CV attached to the active profile, even if they have a reviewed CV", async () => {
      const user = await seedUser();
      const cv = await seedCv(user.id);
      await seedReview(cv.id, { overallScore: 80 });
      await seedProfile(user.id); // no activeCvId

      const state = await searchState(user.id);

      expect(state.activeCv).toBeNull();
      expect(state.cvHealth).toBeNull();
    });

    it("is absent while the active CV has no review yet, but the CV itself is reported", async () => {
      const user = await seedUser();
      const cv = await seedCv(user.id);
      await seedProfile(user.id, { activeCvId: cv.id });

      const state = await searchState(user.id);

      expect(state.activeCv?.id).toBe(cv.id);
      expect(state.cvHealth).toBeNull();
    });

    it("reads the only review's score and open high-severity issues, with no change figure", async () => {
      const user = await seedUser();
      const cv = await seedCv(user.id);
      await seedReview(cv.id, { overallScore: 72, issues: ["HIGH", "MEDIUM", "HIGH", "LOW"] });
      await seedProfile(user.id, { activeCvId: cv.id });

      const { cvHealth } = await searchState(user.id);

      expect(cvHealth).toMatchObject({ cvId: cv.id, score: 72, change: null, highIssues: 2, verdict: "GOOD" });
    });

    it("reports the change from the review before the latest, and the latest review's issues only", async () => {
      const user = await seedUser();
      const cv = await seedCv(user.id);
      await seedReview(cv.id, { overallScore: 55, issues: ["HIGH", "HIGH"], createdAt: new Date(Date.now() - 3 * day) });
      await seedReview(cv.id, { overallScore: 64, issues: ["HIGH"], createdAt: new Date(Date.now() - 2 * day) });
      await seedReview(cv.id, { overallScore: 61, issues: [], createdAt: new Date(Date.now() - day) });
      await seedProfile(user.id, { activeCvId: cv.id });

      const { cvHealth } = await searchState(user.id);

      expect(cvHealth).toMatchObject({ score: 61, change: -3, highIssues: 0 });
    });

    it("reads only the active CV, not a newer review of another CV", async () => {
      const user = await seedUser();
      const active = await seedCv(user.id);
      await seedReview(active.id, { overallScore: 50, createdAt: new Date(Date.now() - 2 * day) });
      const other = await seedCv(user.id);
      await seedReview(other.id, { overallScore: 95, issues: ["HIGH"], createdAt: new Date() });
      await seedProfile(user.id, { activeCvId: active.id });

      const { cvHealth } = await searchState(user.id);

      expect(cvHealth).toMatchObject({ cvId: active.id, score: 50, change: null, highIssues: 0 });
    });
  });

  describe("first-run setup", () => {
    it("reports nothing done for a brand-new account", async () => {
      const user = await seedUser();

      const { setup } = await searchState(user.id);

      expect(setup).toEqual({ cvParsed: false, profileWithCv: false, scored: false, complete: false });
    });

    it("counts an uploaded CV only once it is parsed, and a profile only once that CV is attached", async () => {
      const user = await seedUser();
      const unparsed = await seedCv(user.id, { parsed: false });
      await seedProfile(user.id, { activeCvId: unparsed.id });

      const before = await searchState(user.id);
      expect(before.setup).toMatchObject({ cvParsed: false, profileWithCv: false, scored: false });

      const parsed = await seedCv(user.id);
      const midway = await searchState(user.id);
      expect(midway.setup).toMatchObject({ cvParsed: true, profileWithCv: false });

      await db.searchProfile.updateMany({ where: { userId: user.id }, data: { activeCvId: parsed.id } });
      const ready = await searchState(user.id);
      expect(ready.setup).toEqual({ cvParsed: true, profileWithCv: true, scored: false, complete: false });
    });

    it("is complete once the first scoring run has produced matches", async () => {
      const user = await seedUser();
      const cv = await seedCv(user.id);
      const profile = await seedProfile(user.id, { activeCvId: cv.id });
      const source = await seedSource();
      const posting = await seedPosting(source.id);
      await seedMatch(profile.id, posting.id, { score: 30 });

      const { setup } = await searchState(user.id);

      expect(setup).toEqual({ cvParsed: true, profileWithCv: true, scored: true, complete: true });
    });
  });
});
