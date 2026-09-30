import { describe, expect, it } from "vitest";
import { formatRelative } from "@/lib/formatRelative";

describe("formatRelative", () => {
  const now = new Date("2026-09-30T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms);

  it("says just now inside the first minute", () => {
    expect(formatRelative(ago(20_000), now)).toBe("just now");
  });

  it("counts minutes under an hour", () => {
    expect(formatRelative(ago(12 * 60_000), now)).toBe("12 min ago");
  });

  it("counts hours under a day", () => {
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe("3 h ago");
  });

  it("counts days from a day onwards", () => {
    expect(formatRelative(ago(2 * 86_400_000), now)).toBe("2 d ago");
  });
});
