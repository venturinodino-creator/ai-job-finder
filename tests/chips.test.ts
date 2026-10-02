import { describe, expect, it } from "vitest";
import { addChips, parseChips, removeChip } from "../src/lib/chips";

// The list fields of the search profile (roles, locations, industries,
// languages) are chips: type and press Enter or comma, paste a list, click
// to remove. These are the rules for turning typed text into a list.

describe("parseChips", () => {
  it("splits on commas and new lines, trimming and dropping empty entries", () => {
    expect(parseChips("Account Manager, Channel Manager ,, \n  Sales Lead ")).toEqual(["Account Manager", "Channel Manager", "Sales Lead"]);
  });

  it("keeps a single value as one chip, including inner spaces", () => {
    expect(parseChips("  Key Account Manager ")).toEqual(["Key Account Manager"]);
  });

  it("returns nothing for empty or blank input", () => {
    expect(parseChips("")).toEqual([]);
    expect(parseChips(" , ,\n ")).toEqual([]);
  });
});

describe("addChips", () => {
  it("appends new entries after the existing ones", () => {
    expect(addChips(["Berlin"], "Netherlands, EU")).toEqual(["Berlin", "Netherlands", "EU"]);
  });

  it("ignores an entry that is already there, whatever its casing", () => {
    expect(addChips(["Account Manager"], "account manager")).toEqual(["Account Manager"]);
  });

  it("ignores repeats within one paste and keeps the first spelling", () => {
    expect(addChips([], "EU, eu, Eu, Benelux")).toEqual(["EU", "Benelux"]);
  });

  it("changes nothing for blank input", () => {
    const list = ["Berlin"];
    expect(addChips(list, "  , ")).toEqual(["Berlin"]);
  });

  it("does not modify the list it was given", () => {
    const list = ["Berlin"];
    addChips(list, "Paris");
    expect(list).toEqual(["Berlin"]);
  });
});

describe("removeChip", () => {
  it("removes the chip at an index", () => {
    expect(removeChip(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("leaves the list alone for an index that is not there", () => {
    expect(removeChip(["a"], 5)).toEqual(["a"]);
    expect(removeChip(["a"], -1)).toEqual(["a"]);
  });
});
