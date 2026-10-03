import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { runDigestForUser } from "@/agents/digest";
import { AllowanceExceededError, consume } from "@/lib/entitlements";
import { updateSearchProfile } from "@/lib/searchProfile";
import { ApiError } from "@/lib/api";
import { resetDatabase, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedUser } from "../support/seed";

// Scoring costs real money, so every way of starting a run asks the Free
// allowance first. The model itself is replaced: what matters here is whether
// a run starts, what it costs the user, and what they are told.
const runMatchForProfile = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/agents/match", () => ({ runMatchForProfile }));

describe("starting a scoring run", () => {
  beforeEach(async () => {
    runMatchForProfile.mockReset();
    runMatchForProfile.mockResolvedValue(undefined);
    await resetDatabase();
  });
  afterAll(() => db.$disconnect());

  async function readySearch() {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id });
    return { user, profile };
  }

  it("spends the Free allowance when the user asks for a run", async () => {
    const { user } = await readySearch();

    await runDigestForUser(user.id);

    expect(runMatchForProfile).toHaveBeenCalledTimes(1);
    expect(await db.usageRecord.count({ where: { userId: user.id, action: "SCORING_RUN" } })).toBe(1);
  });

  it("refuses a second request in the same week before anything is scored", async () => {
    const { user } = await readySearch();
    await runDigestForUser(user.id);
    runMatchForProfile.mockClear();

    const attempt = runDigestForUser(user.id);

    await expect(attempt).rejects.toBeInstanceOf(AllowanceExceededError);
    await expect(attempt).rejects.toMatchObject({ refusal: { action: "SCORING_RUN", used: 1, limit: 1 } });
    expect(runMatchForProfile).not.toHaveBeenCalled();
  });

  it("gives the unit back when the run itself fails", async () => {
    const { user } = await readySearch();
    runMatchForProfile.mockRejectedValueOnce(new Error("model unavailable"));

    await expect(runDigestForUser(user.id)).rejects.toThrow("model unavailable");

    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(0);
    await expect(runDigestForUser(user.id)).resolves.not.toBeNull();
  });

  it("does not charge a user whose search is already being scored", async () => {
    const { user, profile } = await readySearch();
    await db.searchProfile.update({ where: { id: profile.id }, data: { scoringStartedAt: new Date() } });

    await expect(runDigestForUser(user.id)).rejects.toThrow(/already in progress/);

    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(0);
  });

  it("does not count the scheduled nightly run against the user's allowance", async () => {
    const { user } = await readySearch();

    await runDigestForUser(user.id, { scheduled: true });
    await runDigestForUser(user.id, { scheduled: true });

    expect(runMatchForProfile).toHaveBeenCalledTimes(2);
    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("saving a search that needs a new scoring run", () => {
  beforeEach(resetDatabase);

  async function searchWithMatches() {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id, targetRoles: ["Account Manager"] });
    const posting = await seedPosting((await seedSource()).id);
    await seedMatch(profile.id, posting.id, { score: 80 });
    return { user, profile };
  }

  it("is refused up front when the allowance is spent, leaving the current search and its matches alone", async () => {
    const { user, profile } = await searchWithMatches();
    await consume(user.id, "SCORING_RUN");

    const attempt = updateSearchProfile(user.id, profile.id, { targetRoles: ["Sales Director"] });

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 429 });
    await expect(attempt).rejects.toThrow(/scoring run/i);
    const after = await db.searchProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after.targetRoles).toEqual(["Account Manager"]);
    expect(await db.matchScore.count({ where: { profileId: profile.id } })).toBe(1);
    expect(await db.searchHistory.count({ where: { userId: user.id } })).toBe(0);
  });

  it("saves as usual while the allowance is there, and does not spend it (the run that follows does)", async () => {
    const { user, profile } = await searchWithMatches();

    const saved = await updateSearchProfile(user.id, profile.id, { targetRoles: ["Sales Director"] });

    expect(saved.rescore).toBe(true);
    expect(await db.usageRecord.count({ where: { userId: user.id } })).toBe(0);
  });

  it("still saves a change that needs no new run when the allowance is spent", async () => {
    const { user, profile } = await searchWithMatches();
    await consume(user.id, "SCORING_RUN");

    const saved = await updateSearchProfile(user.id, profile.id, { name: "Renamed" });

    expect(saved.rescore).toBe(false);
    expect(saved.profile.name).toBe("Renamed");
  });
});
