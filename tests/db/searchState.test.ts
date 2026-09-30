import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { STRONG_MATCH_MIN, searchState } from "@/lib/searchState";
import { resetDatabase, seedApplication, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedTailoredCv, seedUser } from "../support/seed";

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
});
