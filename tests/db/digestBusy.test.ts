import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ScoringBusyError, runDigestForUser } from "@/agents/digest";
import { claimScoringRun } from "@/lib/scoringRun";
import { resetDatabase, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedUser } from "../support/seed";

// The on-demand scoring run refuses to start a second run for a search that
// is already being scored, and says so, instead of racing the first one. It
// is checked here without reaching the model: the refusal happens first.

describe("running the digest while a run is in flight", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  it("is refused with a busy error, and leaves the scores that are there alone", async () => {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id });
    const posting = await seedPosting((await seedSource()).id);
    await seedMatch(profile.id, posting.id, { score: 70 });
    await claimScoringRun(profile.id);

    await expect(runDigestForUser(user.id)).rejects.toBeInstanceOf(ScoringBusyError);

    expect(await db.matchScore.count({ where: { profileId: profile.id } })).toBe(1);
    expect(await db.dailyDigest.count({ where: { userId: user.id } })).toBe(0);
  });

  it("has nothing to run for a user with no search, as before", async () => {
    const user = await seedUser();
    await expect(runDigestForUser(user.id)).resolves.toBeNull();
  });
});
