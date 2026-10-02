import { describe, expect, it } from "vitest";
import { saveConsequence, valuesFromProfile, type ProfileFormValues } from "../src/lib/profileConsequence";

// The profile page says what saving will do before the user presses Save:
// whether the form differs from the saved search, the sentence that states
// the consequence with real numbers, and what the button is called. Reading
// "differs" the way the server does means a reordering or a change of
// casing is not a change.

const saved: ProfileFormValues = {
  targetRoles: ["Account Manager", "Channel Manager"],
  locations: ["Cape Town", "Netherlands"],
  remotePref: "ON_SITE",
  seniority: "SENIOR",
  salaryMin: 91000,
  salaryMax: 120000,
  salaryCurrency: "EUR",
  expectsCommission: true,
  industries: ["AI solutions"],
  languages: ["English"],
};
const search = { scored: 55, applied: 3 };

describe("saveConsequence for an existing search", () => {
  it("is not dirty, offers nothing to save and says nothing for an untouched form", () => {
    const result = saveConsequence({ saved, edited: { ...saved }, ...search });

    expect(result).toMatchObject({ dirty: false, replaces: false, statement: null, buttonLabel: "No changes to save" });
  });

  it("treats a reordering or a change of casing as no change", () => {
    const edited = { ...saved, targetRoles: ["channel manager", " Account Manager "], locations: ["NETHERLANDS", "cape town"] };

    expect(saveConsequence({ saved, edited, ...search }).dirty).toBe(false);
  });

  it("treats an unused currency as no change when no salary is set", () => {
    const noSalary = { ...saved, salaryMin: null, salaryMax: null, salaryCurrency: null };

    expect(saveConsequence({ saved: noSalary, edited: { ...noSalary, salaryCurrency: "USD" }, ...search }).dirty).toBe(false);
  });

  it("states the consequence with the real counts once any field differs", () => {
    const result = saveConsequence({ saved, edited: { ...saved, locations: ["Germany"] }, ...search });

    expect(result.dirty).toBe(true);
    expect(result.replaces).toBe(true);
    expect(result.buttonLabel).toBe("Save and re-score");
    expect(result.statement).toBe(
      "Saving replaces your current search: it is archived with its 55 matches, the 3 you applied to are kept, and re-scoring takes 1–3 minutes.",
    );
  });

  it("uses singular wording for one match and one application", () => {
    const result = saveConsequence({ saved, edited: { ...saved, remotePref: "REMOTE" }, scored: 1, applied: 1 });

    expect(result.statement).toContain("archived with its 1 match,");
    expect(result.statement).toContain("the 1 you applied to is kept");
  });

  it("leaves out the applied clause when nothing was applied to", () => {
    const result = saveConsequence({ saved, edited: { ...saved, seniority: "MID" }, scored: 12, applied: 0 });

    expect(result.statement).toBe("Saving replaces your current search: it is archived with its 12 matches, and re-scoring takes 1–3 minutes.");
  });

  it("says there is nothing to archive when the search has no matches yet", () => {
    const result = saveConsequence({ saved, edited: { ...saved, targetRoles: ["Sales Lead"] }, scored: 0, applied: 0 });

    expect(result.statement).toBe("Saving starts a new search and re-scores it, which takes 1–3 minutes. Nothing is archived: the current search has no matches.");
  });

  it("notices a change in each kind of field", () => {
    const changes: Partial<ProfileFormValues>[] = [
      { targetRoles: ["Account Manager"] },
      { locations: [] },
      { remotePref: "ANY" },
      { seniority: null },
      { salaryMin: 100000 },
      { salaryMax: null },
      { salaryCurrency: "USD" },
      { expectsCommission: false },
      { industries: [] },
      { languages: ["English", "Dutch"] },
    ];
    for (const change of changes) {
      expect(saveConsequence({ saved, edited: { ...saved, ...change }, ...search }).dirty, JSON.stringify(change)).toBe(true);
    }
  });
});

describe("saveConsequence for a first search", () => {
  it("is always ready to create, and says what creating does", () => {
    const result = saveConsequence({ saved: null, edited: { ...saved }, scored: 0, applied: 0 });

    expect(result).toMatchObject({ dirty: true, replaces: false, buttonLabel: "Create search profile" });
    expect(result.statement).toMatch(/takes you to the Overview/);
    expect(result.statement).toMatch(/first scoring run/);
  });
});

describe("valuesFromProfile", () => {
  it("reads the form's values from a saved profile, filling defaults", () => {
    expect(
      valuesFromProfile({
        targetRoles: ["A"],
        locations: [],
        remotePref: "ANY",
        seniority: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: "USD",
        expectsCommission: false,
        industries: [],
        languages: [],
      }),
    ).toEqual({
      targetRoles: ["A"],
      locations: [],
      remotePref: "ANY",
      seniority: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "USD",
      expectsCommission: false,
      industries: [],
      languages: [],
    });
  });
});
