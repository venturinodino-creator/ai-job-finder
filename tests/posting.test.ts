import { describe, expect, it } from "vitest";
import { postingFromArchivedResult, postingFromCompanyPosting, postingFromMatch, readingTone } from "../src/lib/posting";
import { STRONG_MATCH_MIN } from "../src/lib/pipelineStages";

// One Posting card renders a posting wherever postings are listed. These
// adapters turn each view's rows into the card's one shape, and the tone
// rule decides the colour of the reading.

const job = {
  id: "p1",
  title: "Account Manager",
  company: "Acme",
  location: "Cape Town",
  remoteType: "ON_SITE",
  postedAt: new Date("2026-09-28T00:00:00Z"),
  source: { name: "Test board" },
  url: "https://example.test/p1",
};

describe("posting adapters", () => {
  it("maps a scored match, marking applied and location-mismatch", () => {
    const summary = postingFromMatch({
      score: 72,
      isWildcard: false,
      explanation: "Fits.",
      wildcardReason: null,
      appliedAt: new Date(),
      locationMismatch: true,
      jobPosting: job,
    });

    expect(summary).toMatchObject({
      id: "p1",
      title: "Account Manager",
      company: "Acme",
      location: "Cape Town",
      remoteType: "ON_SITE",
      sourceName: "Test board",
      postedAt: job.postedAt,
      reading: { score: 72, isWildcard: false, explanation: "Fits.", applied: true, locationMismatch: true },
    });
  });

  it("maps a company posting the profile has not scored to the not-yet-scored state", () => {
    const summary = postingFromCompanyPosting({ ...job, match: null });
    expect(summary.reading).toBeNull();
    expect(summary.sourceName).toBe("Test board");
  });

  it("maps a scored company posting, defaulting an absent mismatch flag to false", () => {
    const summary = postingFromCompanyPosting({ ...job, match: { score: 40, isWildcard: true, appliedAt: null } });
    expect(summary.reading).toEqual({ score: 40, isWildcard: true, explanation: null, wildcardReason: null, applied: false, locationMismatch: false });
  });

  it("maps an archived result, which has no remote type or posting date", () => {
    const summary = postingFromArchivedResult({
      jobPostingId: "p1",
      title: "Account Manager",
      company: "Acme",
      location: null,
      source: "Test board",
      url: job.url,
      score: 61,
      isWildcard: false,
      explanation: "Was a fit.",
      applied: true,
    });
    expect(summary).toMatchObject({ id: "p1", location: null, remoteType: null, postedAt: null, sourceName: "Test board" });
    expect(summary.reading).toMatchObject({ score: 61, applied: true, locationMismatch: false });
  });
});

describe("readingTone", () => {
  it("colours wildcards as gamify, strong matches as secondary, the rest as accent", () => {
    expect(readingTone({ score: 95, isWildcard: true })).toBe("gamify");
    expect(readingTone({ score: STRONG_MATCH_MIN, isWildcard: false })).toBe("secondary");
    expect(readingTone({ score: STRONG_MATCH_MIN - 1, isWildcard: false })).toBe("accent");
  });
});
