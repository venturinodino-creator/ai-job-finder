import { describe, expect, it } from "vitest";
import { isLocationMismatch, locationFit, placeMatchesRegion } from "../src/lib/locationFit";

describe("placeMatchesRegion", () => {
  it("matches cities and codes of a known region, case-insensitively", () => {
    expect(placeMatchesRegion("Cape Town, South Africa", "south africa")).toBe(true);
    expect(placeMatchesRegion("Johannesburg", "South Africa")).toBe(true);
    expect(placeMatchesRegion("Sandton, ZA", "south africa")).toBe(true);
    expect(placeMatchesRegion("Amsterdam", "Netherlands")).toBe(true);
    expect(placeMatchesRegion("Utrecht, NL", "nl")).toBe(true);
  });

  it("does not let short codes match inside other words", () => {
    expect(placeMatchesRegion("Denver, CO", "germany")).toBe(false); // "de" inside "Denver"
    expect(placeMatchesRegion("Zaandam", "south africa")).toBe(false); // "za" inside "Zaandam"
  });

  it("expands region groups", () => {
    expect(placeMatchesRegion("Berlin", "EU")).toBe(true);
    expect(placeMatchesRegion("Copenhagen", "Nordics")).toBe(true);
    expect(placeMatchesRegion("Cape Town", "EMEA")).toBe(true);
    expect(placeMatchesRegion("New York", "Europe")).toBe(false);
  });

  it("falls back to containment for unknown free text", () => {
    expect(placeMatchesRegion("Remote - Mauritius", "mauritius")).toBe(true);
    expect(placeMatchesRegion("London", "mauritius")).toBe(false);
  });
});

describe("locationFit", () => {
  it("is unconstrained without profile locations", () => {
    expect(locationFit([], "London", "ON_SITE")).toBe("unconstrained");
  });

  it("classifies match, remote, unknown and outside", () => {
    expect(locationFit(["south africa"], "Cape Town", "ON_SITE")).toBe("match");
    expect(locationFit(["south africa"], "Remote - EMEA", "REMOTE")).toBe("remote");
    expect(locationFit(["south africa"], "Anywhere", "HYBRID")).toBe("remote");
    expect(locationFit(["south africa"], null, "ON_SITE")).toBe("unknown");
    expect(locationFit(["south africa"], "Hybrid", "HYBRID")).toBe("unknown");
    expect(locationFit(["south africa"], "On-site", "ON_SITE")).toBe("unknown");
    expect(locationFit(["south africa"], "London", "ON_SITE")).toBe("outside");
    expect(locationFit(["south africa"], "Bristol", "ANY")).toBe("outside");
  });

  it("prefers a location match over the remote label", () => {
    expect(locationFit(["Netherlands"], "Remote (Netherlands)", "REMOTE")).toBe("match");
  });
});

describe("isLocationMismatch", () => {
  it("only applies to on-site and hybrid profiles", () => {
    expect(isLocationMismatch(["south africa"], "ON_SITE", "London", "ON_SITE")).toBe(true);
    expect(isLocationMismatch(["south africa"], "HYBRID", "London", "ANY")).toBe(true);
    expect(isLocationMismatch(["south africa"], "REMOTE", "London", "ON_SITE")).toBe(false);
    expect(isLocationMismatch(["south africa"], "ANY", "London", "ON_SITE")).toBe(false);
  });

  it("never flags remote postings, unknown locations or matching places", () => {
    expect(isLocationMismatch(["south africa"], "ON_SITE", "Remote", "REMOTE")).toBe(false);
    expect(isLocationMismatch(["south africa"], "ON_SITE", null, "ON_SITE")).toBe(false);
    expect(isLocationMismatch(["south africa"], "ON_SITE", "Durban", "ON_SITE")).toBe(false);
  });
});
