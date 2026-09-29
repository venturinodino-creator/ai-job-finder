import { describe, expect, it } from "vitest";
import { parseArchivedResults, toArchivedResults } from "../src/lib/archivedResults";

function match(over: Partial<{ score: number; isWildcard: boolean; appliedAt: Date | null; id: string }> = {}) {
  const id = over.id ?? "job1";
  return {
    score: over.score ?? 50,
    isWildcard: over.isWildcard ?? false,
    explanation: "why",
    appliedAt: over.appliedAt ?? null,
    jobPosting: { id, title: `Title ${id}`, company: "Co", location: "Amsterdam", url: `https://x/${id}`, source: { name: "Src" } },
  };
}

describe("toArchivedResults", () => {
  it("orders main matches by score, then wildcards, and flattens the posting", () => {
    const out = toArchivedResults([
      match({ id: "w", score: 90, isWildcard: true }),
      match({ id: "a", score: 60 }),
      match({ id: "b", score: 80, appliedAt: new Date() }),
    ]);
    expect(out.map((r) => r.jobPostingId)).toEqual(["b", "a", "w"]);
    expect(out[0]).toMatchObject({ title: "Title b", company: "Co", source: "Src", url: "https://x/b", score: 80, applied: true, isWildcard: false });
    expect(out[2].isWildcard).toBe(true);
  });

  it("caps the number of archived results", () => {
    const many = Array.from({ length: 80 }, (_, i) => match({ id: `j${i}`, score: i }));
    expect(toArchivedResults(many, 60)).toHaveLength(60);
    expect(toArchivedResults(many, 60)[0].score).toBe(79);
  });
});

describe("parseArchivedResults", () => {
  it("round-trips what toArchivedResults produced", () => {
    const archived = toArchivedResults([match({ id: "a" })]);
    expect(parseArchivedResults(JSON.parse(JSON.stringify(archived)))).toEqual(archived);
  });

  it("ignores malformed values", () => {
    expect(parseArchivedResults(null)).toEqual([]);
    expect(parseArchivedResults("nope")).toEqual([]);
    expect(parseArchivedResults([{ foo: 1 }, { jobPostingId: "a", title: "t" }])).toHaveLength(1);
  });
});
