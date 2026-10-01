import { describe, expect, it } from "vitest";
import { backLink, parseOrigin, postingHref } from "../src/lib/postingOrigin";

// A posting link carries where it was opened from; the posting page turns
// that into a way back. One rule, three functions: build the link, read the
// origin back out of the address, and name the way back.

describe("postingHref", () => {
  it("is the bare posting address when no origin is given", () => {
    expect(postingHref("p1")).toBe("/dashboard/jobs/p1");
  });

  it("carries the Matches view and its stage filter", () => {
    expect(postingHref("p1", { view: "matches", stage: "strong" })).toBe("/dashboard/jobs/p1?from=matches&stage=strong");
    expect(postingHref("p1", { view: "matches", stage: null })).toBe("/dashboard/jobs/p1?from=matches");
  });

  it("carries the company query, encoded", () => {
    expect(postingHref("p1", { view: "companies", companies: "Cohere, Notion & Co" })).toBe(
      "/dashboard/jobs/p1?from=companies&companies=Cohere%2C+Notion+%26+Co",
    );
  });

  it("carries the Archive view", () => {
    expect(postingHref("p1", { view: "archive" })).toBe("/dashboard/jobs/p1?from=archive");
  });
});

describe("parseOrigin", () => {
  it("reads back what postingHref wrote", () => {
    expect(parseOrigin({ from: "matches", stage: "opened" })).toEqual({ view: "matches", stage: "opened" });
    expect(parseOrigin({ from: "companies", companies: "Cohere, Notion" })).toEqual({ view: "companies", companies: "Cohere, Notion" });
    expect(parseOrigin({ from: "archive" })).toEqual({ view: "archive" });
  });

  it("falls back to unfiltered Matches for a missing or unknown origin", () => {
    expect(parseOrigin({})).toEqual({ view: "matches", stage: null });
    expect(parseOrigin({ from: "somewhere-else", stage: "strong" })).toEqual({ view: "matches", stage: null });
    expect(parseOrigin({ from: ["matches", "archive"] })).toEqual({ view: "matches", stage: null });
  });

  it("drops an unknown stage but keeps the Matches view", () => {
    expect(parseOrigin({ from: "matches", stage: "bogus" })).toEqual({ view: "matches", stage: null });
  });

  it("treats a company origin with no query as the empty search", () => {
    expect(parseOrigin({ from: "companies" })).toEqual({ view: "companies", companies: "" });
  });
});

describe("backLink", () => {
  it("returns to Matches, keeping the stage filter in the address and the label", () => {
    expect(backLink({ view: "matches", stage: null })).toEqual({ href: "/dashboard/jobs", label: "Back to Matches" });
    expect(backLink({ view: "matches", stage: "strong" })).toEqual({ href: "/dashboard/jobs?stage=strong", label: "Back to Matches: Strong" });
    expect(backLink({ view: "matches", stage: "prepared" })).toEqual({ href: "/dashboard/jobs?stage=prepared", label: "Back to Matches: Tailored or drafted" });
  });

  it("treats the scored stage as unfiltered Matches", () => {
    expect(backLink({ view: "matches", stage: "scored" })).toEqual({ href: "/dashboard/jobs", label: "Back to Matches" });
  });

  it("returns to the company search with its results", () => {
    expect(backLink({ view: "companies", companies: "Cohere, Notion" })).toEqual({
      href: "/dashboard/jobs/companies?companies=Cohere%2C+Notion",
      label: "Back to Companies: Cohere, Notion",
    });
    expect(backLink({ view: "companies", companies: "" })).toEqual({ href: "/dashboard/jobs/companies", label: "Back to Companies" });
  });

  it("returns to the Archive", () => {
    expect(backLink({ view: "archive" })).toEqual({ href: "/dashboard/jobs/archive", label: "Back to Archive" });
  });

  it("round-trips: a link built for an origin leads back to that origin", () => {
    const origin = { view: "matches", stage: "applied" } as const;
    const url = new URL(postingHref("p1", origin), "https://example.test");
    expect(backLink(parseOrigin(Object.fromEntries(url.searchParams)))).toEqual({ href: "/dashboard/jobs?stage=applied", label: "Back to Matches: Applied" });
  });
});
