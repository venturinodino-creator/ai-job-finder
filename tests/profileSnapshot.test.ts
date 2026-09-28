import { describe, expect, it } from "vitest";
import { describeSnapshot, profileSnapshot, snapshotsDiffer } from "../src/lib/profileSnapshot";

const base = {
  targetRoles: ["Account Manager", " Key Account Manager "],
  locations: ["Netherlands", "EU"],
  remotePref: "REMOTE",
  seniority: "SENIOR",
  salaryMin: 91000,
  salaryMax: 120000,
  salaryCurrency: "EUR",
  expectsCommission: true,
  industries: ["AI solutions", "OpenAI"],
  languages: ["English", "afrikaans"],
  activeCvId: "cv1",
};

describe("profileSnapshot", () => {
  it("normalises list whitespace and fills defaults", () => {
    const s = profileSnapshot({ targetRoles: [" a ", ""], locations: [], remotePref: "ANY", industries: [], languages: [] });
    expect(s.targetRoles).toEqual(["a"]);
    expect(s.seniority).toBeNull();
    expect(s.expectsCommission).toBe(false);
    expect(s.activeCvId).toBeNull();
  });

  it("detects match-relevant changes and ignores no-ops", () => {
    const a = profileSnapshot(base);
    expect(snapshotsDiffer(a, profileSnapshot({ ...base }))).toBe(false);
    expect(snapshotsDiffer(a, profileSnapshot({ ...base, locations: ["Germany"] }))).toBe(true);
    expect(snapshotsDiffer(a, profileSnapshot({ ...base, targetRoles: ["Sales Director"] }))).toBe(true);
    expect(snapshotsDiffer(a, profileSnapshot({ ...base, activeCvId: "cv2" }))).toBe(true);
  });

  it("describes a snapshot in one line", () => {
    expect(describeSnapshot(profileSnapshot(base))).toBe(
      "Account Manager / Key Account Manager · Netherlands, EU · remote · senior · EUR 91k–120k · AI solutions, OpenAI",
    );
    expect(describeSnapshot(profileSnapshot({ targetRoles: [], locations: [], remotePref: "ANY", industries: [], languages: [] }))).toBe(
      "Any role · any location type",
    );
  });
});
