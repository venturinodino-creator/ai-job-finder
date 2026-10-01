import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { markAlreadyApplied, undoApplied } from "@/lib/applications";
import { postingState, searchState } from "@/lib/searchState";
import { resetDatabase, seedApplication, seedCv, seedMatch, seedPosting, seedProfile, seedSource, seedUser } from "../support/seed";

// "Applied" has one source of truth: the application record. These tests
// cover the two things the Applications module adds for that: saying "I
// already applied" without a draft, and undoing an applied state that did
// not send an email. They look at what the calls return and what the
// pipeline and the per-posting reading say afterwards.

describe("marking applied and undoing it", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  async function seedSearch() {
    const user = await seedUser();
    const cv = await seedCv(user.id);
    const profile = await seedProfile(user.id, { activeCvId: cv.id });
    const source = await seedSource();
    const posting = await seedPosting(source.id);
    return { user, cv, profile, source, posting };
  }
  const appliedActivities = (userId: string) => db.activityEvent.count({ where: { userId, type: "JOB_APPLIED" } });

  describe("I already applied", () => {
    it("marks a scored posting applied in one call, with no draft, and the pipeline counts it", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id, { score: 70 });

      const application = await markAlreadyApplied(user.id, posting.id);

      expect(application).toMatchObject({ status: "APPLIED", method: "MANUAL", coverNote: "" });
      expect(application.sentAt).toBeInstanceOf(Date);
      expect((await searchState(user.id)).pipeline.applied).toBe(1);
      expect((await postingState(user.id, posting.id))?.steps.applied?.method).toBe("MANUAL");
    });

    it("works on a posting the search has not scored", async () => {
      const { user, posting } = await seedSearch();

      await markAlreadyApplied(user.id, posting.id);

      const state = await postingState(user.id, posting.id);
      expect(state?.reading).toBeNull();
      expect(state?.steps.applied).not.toBeNull();
    });

    it("works for a user with no profile or CV", async () => {
      const user = await seedUser();
      const posting = await seedPosting((await seedSource()).id);

      await expect(markAlreadyApplied(user.id, posting.id)).resolves.toMatchObject({ status: "APPLIED" });
    });

    it("keeps an existing draft's cover note when the draft becomes applied", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id);
      await seedApplication(user.id, posting.id, "DRAFT");

      const application = await markAlreadyApplied(user.id, posting.id);

      expect(application).toMatchObject({ status: "APPLIED", method: "MANUAL", coverNote: "Hello." });
    });

    it("leaves an emailed application as it is", async () => {
      const { user, posting } = await seedSearch();
      const sentAt = new Date("2026-09-29T08:30:00Z");
      await seedApplication(user.id, posting.id, "SENT", { method: "EMAIL", sentAt });

      const application = await markAlreadyApplied(user.id, posting.id);

      expect(application).toMatchObject({ status: "SENT", method: "EMAIL", sentAt });
    });

    it("records the applying activity once per posting, however often it is marked", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id);

      await markAlreadyApplied(user.id, posting.id);
      await markAlreadyApplied(user.id, posting.id);
      await undoApplied(user.id, posting.id);
      await markAlreadyApplied(user.id, posting.id);

      expect(await appliedActivities(user.id)).toBe(1);
    });

    it("refuses a posting that does not exist", async () => {
      const user = await seedUser();
      await expect(markAlreadyApplied(user.id, "no-such-posting")).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("undo", () => {
    it("removes an 'I already applied' record and the posting leaves the Applied stage", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id, { score: 70 });
      await markAlreadyApplied(user.id, posting.id);

      const result = await undoApplied(user.id, posting.id);

      expect(result).toEqual({ undone: true, application: null });
      expect((await searchState(user.id)).pipeline.applied).toBe(0);
      expect((await postingState(user.id, posting.id))?.steps.applied).toBeNull();
    });

    it("returns an application applied on the company site to a draft, cover note intact", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id, { appliedAt: new Date() });
      await seedApplication(user.id, posting.id, "APPLIED", { method: "MANUAL", sentAt: new Date() });

      const result = await undoApplied(user.id, posting.id);

      expect(result.undone).toBe(true);
      expect(result.application).toMatchObject({ status: "DRAFT", method: null, sentAt: null, coverNote: "Hello." });
      const state = await postingState(user.id, posting.id);
      expect(state?.steps).toMatchObject({ prepared: true, applied: null });
    });

    it("clears a posting that was only marked applied on its match row", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id, { appliedAt: new Date() });

      const result = await undoApplied(user.id, posting.id);

      expect(result).toEqual({ undone: true, application: null });
      expect((await searchState(user.id)).pipeline.applied).toBe(0);
    });

    it("refuses to undo an emailed application and changes nothing", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id, { appliedAt: new Date() });
      await seedApplication(user.id, posting.id, "SENT", { method: "EMAIL", sentAt: new Date() });

      await expect(undoApplied(user.id, posting.id)).rejects.toMatchObject({ status: 400 });
      expect((await searchState(user.id)).pipeline.applied).toBe(1);
    });

    it("does nothing when the posting is not applied", async () => {
      const { user, profile, posting } = await seedSearch();
      await seedMatch(profile.id, posting.id);
      await seedApplication(user.id, posting.id, "DRAFT");

      const result = await undoApplied(user.id, posting.id);

      expect(result.undone).toBe(false);
      expect(result.application).toMatchObject({ status: "DRAFT" });
    });

    it("never touches another user's application or match rows", async () => {
      const { user, posting } = await seedSearch();
      const other = await seedUser();
      const otherProfile = await seedProfile(other.id);
      await seedMatch(otherProfile.id, posting.id, { appliedAt: new Date() });
      await markAlreadyApplied(other.id, posting.id);

      await undoApplied(user.id, posting.id);

      expect((await postingState(other.id, posting.id))?.steps.applied).not.toBeNull();
    });
  });
});
