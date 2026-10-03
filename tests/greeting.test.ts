import { describe, expect, it } from "vitest";
import { greetingFor } from "../src/lib/greeting";

// The greeting is read in the user's own timezone, so a user in Amsterdam
// is not told "good morning" at 11pm because the server runs on UTC.

describe("greetingFor", () => {
  const at = (iso: string) => new Date(iso);

  it("greets by the time of day where the user is, not where the server is", () => {
    const instant = at("2026-10-03T22:30:00Z");
    expect(greetingFor("Dino", "UTC", instant)).toBe("Good evening, Dino");
    expect(greetingFor("Dino", "Asia/Tokyo", instant)).toBe("Good morning, Dino"); // 07:30 there
  });

  it("covers morning, afternoon and the small hours", () => {
    expect(greetingFor("Dino", "UTC", at("2026-10-03T08:00:00Z"))).toBe("Good morning, Dino");
    expect(greetingFor("Dino", "UTC", at("2026-10-03T14:00:00Z"))).toBe("Good afternoon, Dino");
    expect(greetingFor("Dino", "UTC", at("2026-10-03T02:00:00Z"))).toBe("Working late, Dino");
  });

  it("uses only the first name, and none when it is missing", () => {
    expect(greetingFor("Dino Venturino", "UTC", at("2026-10-03T08:00:00Z"))).toBe("Good morning, Dino");
    expect(greetingFor(null, "UTC", at("2026-10-03T08:00:00Z"))).toBe("Good morning");
    expect(greetingFor("   ", "UTC", at("2026-10-03T08:00:00Z"))).toBe("Good morning");
  });

  it("falls back to UTC for a timezone it does not know", () => {
    expect(greetingFor("Dino", "Not/AZone", at("2026-10-03T08:00:00Z"))).toBe("Good morning, Dino");
  });
});
