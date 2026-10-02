import { describe, expect, it } from "vitest";
import { describeLocation, isLocationMismatch, locationFit, placeMatchesRegion } from "../src/lib/locationFit";

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

describe("describeLocation", () => {
  it("recognises a country by name, code and casing", () => {
    expect(describeLocation("South Africa")).toMatchObject({ kind: "region", region: "South Africa" });
    expect(describeLocation("  south   africa ")).toMatchObject({ kind: "region", region: "South Africa" });
    expect(describeLocation("NL")).toMatchObject({ kind: "region", region: "Netherlands" });
    expect(describeLocation("UAE")).toMatchObject({ kind: "region", region: "United Arab Emirates" });
  });

  it("recognises a city and names the region it belongs to", () => {
    const reading = describeLocation("Cape Town");
    expect(reading).toMatchObject({ kind: "region", region: "South Africa" });
    expect(reading.label).toContain("South Africa");
  });

  it("recognises a named group and says what it covers", () => {
    const eu = describeLocation("EU");
    expect(eu.kind).toBe("group");
    expect(eu.hint).toContain("Netherlands");
    expect(eu.hint).toContain("Germany");
    expect(describeLocation("dach")).toMatchObject({ kind: "group" });
    expect(describeLocation("DACH").hint).toContain("Austria");
  });

  it("marks anything else as matched only as typed, with a hint to check the spelling", () => {
    const typo = describeLocation("Cape Twon");
    expect(typo.kind).toBe("typed");
    expect(typo.hint).toMatch(/only as typed/i);
    expect(typo.hint).toContain("Cape Twon");
    expect(typo.hint).toMatch(/spelling/i);
  });

  it("explains that a short unknown entry has to match a whole word", () => {
    expect(describeLocation("xy").hint).toMatch(/whole word/i);
  });

  it("treats a blank entry as empty", () => {
    expect(describeLocation("   ")).toMatchObject({ kind: "empty" });
  });

  it("agrees with the matcher: what it calls recognised does match postings there", () => {
    for (const place of ["Cape Town", "NL", "EU", "Berlin"]) {
      expect(describeLocation(place).kind).not.toBe("typed");
    }
    expect(placeMatchesRegion("Amsterdam", "EU")).toBe(true);
    expect(placeMatchesRegion("Amsterdam", "NL")).toBe(true);
  });
});
