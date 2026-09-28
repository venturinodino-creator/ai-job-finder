import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText } from "../src/agents/sources/html";
import { allCompanyBoards, boardsFor, parseBoardList } from "../src/agents/sources/companyBoards";
import { buildSourceStatus } from "../src/lib/sourceStatus";

describe("html helpers", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("H&amp;M &lt;3 &#39;x&#x27; &nbsp;&unknown;")).toBe("H&M <3 'x'  &unknown;".replace(" ", " "));
  });

  it("turns entity-encoded HTML (Greenhouse style) into readable text", () => {
    const raw = "&lt;p&gt;&lt;strong&gt;About&lt;/strong&gt;&lt;/p&gt;\n&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;li&gt;Two&lt;/li&gt;&lt;/ul&gt;";
    expect(htmlToText(decodeEntities(raw))).toBe("About\n\nOne\nTwo");
  });

  it("collapses whitespace but keeps paragraph breaks", () => {
    expect(htmlToText("<p>a   b</p>\n\n\n\n<p>c</p>")).toBe("a b\n\nc");
  });
});

describe("company board config", () => {
  it("parses slug and slug:Name entries, lower-casing slugs", () => {
    expect(parseBoardList("lever", " Palantir , nium:Nium Ltd ,bad slug!,")).toEqual([
      { platform: "lever", slug: "palantir", name: "Palantir" },
      { platform: "lever", slug: "nium", name: "Nium Ltd" },
    ]);
  });

  it("de-duplicates by slug and title-cases missing names", () => {
    expect(parseBoardList("ashby", "open-ai,OPEN-AI:OpenAI")).toEqual([{ platform: "ashby", slug: "open-ai", name: "Open Ai" }]);
  });

  it("uses defaults unless the env var is set, and honours an empty override", () => {
    expect(boardsFor("greenhouse", {}).length).toBeGreaterThan(5);
    expect(boardsFor("greenhouse", { GREENHOUSE_BOARDS: "" })).toEqual([]);
    expect(boardsFor("greenhouse", { GREENHOUSE_BOARDS: "adyen" })).toEqual([{ platform: "greenhouse", slug: "adyen", name: "Adyen" }]);
  });

  it("returns boards for all three platforms with unique keys", () => {
    const boards = allCompanyBoards({});
    const keys = boards.map((b) => `${b.platform}:${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(boards.some((b) => b.platform === "lever")).toBe(true);
    expect(boards.some((b) => b.platform === "ashby")).toBe(true);
  });
});

describe("buildSourceStatus", () => {
  const configured = [
    { key: "b", name: "Beta", baseUrl: "https://b" },
    { key: "a", name: "Alpha", baseUrl: "https://a", kind: "COMPANY_BOARD" as const },
    { key: "c", name: "Gamma", baseUrl: "https://c" },
    { key: "d", name: "Delta", baseUrl: "https://d" },
  ];
  const stored = [
    { key: "a", enabled: true, lastFetchedAt: new Date("2026-09-28T05:00:00Z"), lastError: null, postings: 12 },
    { key: "b", enabled: true, lastFetchedAt: new Date("2026-09-28T05:00:00Z"), lastError: "boom", postings: 3 },
    { key: "c", enabled: false, lastFetchedAt: null, lastError: null, postings: 0 },
  ];

  it("marks health per row and treats unknown sources as pending", () => {
    const statuses = buildSourceStatus(configured, stored);
    const byKey = Object.fromEntries(statuses.map((s) => [s.key, s]));
    expect(byKey.a.health).toBe("ok");
    expect(byKey.a.kind).toBe("COMPANY_BOARD");
    expect(byKey.b.health).toBe("error");
    expect(byKey.b.lastError).toBe("boom");
    expect(byKey.c.health).toBe("disabled");
    expect(byKey.d.health).toBe("pending");
    expect(byKey.d.postings).toBe(0);
  });

  it("sorts by display name", () => {
    expect(buildSourceStatus(configured, stored).map((s) => s.name)).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
  });
});
