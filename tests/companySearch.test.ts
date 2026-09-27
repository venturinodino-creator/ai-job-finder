import { describe, expect, it } from "vitest";
import { MAX_COMPANIES, groupPostingsByCompany, parseCompanyQuery } from "../src/lib/companySearch";

describe("parseCompanyQuery", () => {
  it("returns an empty list for missing or blank input", () => {
    expect(parseCompanyQuery(undefined)).toEqual([]);
    expect(parseCompanyQuery("")).toEqual([]);
    expect(parseCompanyQuery("  , ,, ")).toEqual([]);
  });

  it("splits on commas, semicolons and newlines and trims", () => {
    expect(parseCompanyQuery(" OpenAI , Anthropic;Google\nMistral ")).toEqual([
      "OpenAI",
      "Anthropic",
      "Google",
      "Mistral",
    ]);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(parseCompanyQuery("OpenAI, openai, OPENAI, Anthropic")).toEqual(["OpenAI", "Anthropic"]);
  });

  it("caps the number of companies and the length of each name", () => {
    const many = Array.from({ length: MAX_COMPANIES + 5 }, (_, i) => `Company ${i}`).join(",");
    expect(parseCompanyQuery(many)).toHaveLength(MAX_COMPANIES);
    expect(parseCompanyQuery("x".repeat(500))[0]).toHaveLength(80);
  });

  it("accepts a repeated query param as an array", () => {
    expect(parseCompanyQuery(["OpenAI", "Anthropic"])).toEqual(["OpenAI", "Anthropic"]);
  });
});

describe("groupPostingsByCompany", () => {
  const postings = [
    { id: "1", company: "OpenAI" },
    { id: "2", company: "OpenAI Inc." },
    { id: "3", company: "Google DeepMind" },
    { id: "4", company: "Anthropic" },
  ];

  it("matches case-insensitively on substring", () => {
    const groups = groupPostingsByCompany(["openai"], postings);
    expect(groups[0].postings.map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("keeps an empty group for companies with no postings", () => {
    const groups = groupPostingsByCompany(["Anthropic", "Mistral"], postings);
    expect(groups).toEqual([
      { name: "Anthropic", postings: [postings[3]] },
      { name: "Mistral", postings: [] },
    ]);
  });

  it("preserves the requested order and lets overlapping names share postings", () => {
    const groups = groupPostingsByCompany(["Google DeepMind", "Google"], postings);
    expect(groups.map((g) => g.name)).toEqual(["Google DeepMind", "Google"]);
    expect(groups[0].postings.map((p) => p.id)).toEqual(["3"]);
    expect(groups[1].postings.map((p) => p.id)).toEqual(["3"]);
  });
});
