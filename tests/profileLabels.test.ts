import { describe, expect, it } from "vitest";
import { remoteRule, REMOTE_LABELS, SENIORITY_LABELS } from "../src/lib/profileLabels";
import { OUTSIDE_LOCATION_PENALTY } from "../src/lib/locationFit";

describe("labels", () => {
  it("names every remote preference and seniority in plain words", () => {
    expect(REMOTE_LABELS).toEqual({ ANY: "Any", REMOTE: "Remote", HYBRID: "Hybrid", ON_SITE: "On-site" });
    expect(SENIORITY_LABELS.MID).toBe("Mid-level");
    expect(Object.keys(SENIORITY_LABELS)).toHaveLength(9);
    for (const label of Object.values({ ...REMOTE_LABELS, ...SENIORITY_LABELS })) expect(label).not.toMatch(/[A-Z]{2,}_|_/);
  });
});

describe("remoteRule", () => {
  it("states the points lost and the tag for on-site and hybrid searches", () => {
    for (const pref of ["ON_SITE", "HYBRID"] as const) {
      const line = remoteRule(pref, ["Cape Town"]);
      expect(line).toContain(`${OUTSIDE_LOCATION_PENALTY} points`);
      expect(line).toContain("Outside your locations");
    }
  });

  it("says location is a soft preference for remote and any", () => {
    for (const pref of ["REMOTE", "ANY"] as const) {
      const line = remoteRule(pref, ["Cape Town"]);
      expect(line).toMatch(/soft preference/i);
      expect(line).not.toContain("points");
    }
  });

  it("tells an on-site search with no locations that nothing can be docked yet", () => {
    expect(remoteRule("ON_SITE", [])).toMatch(/add a location/i);
    expect(remoteRule("HYBRID", [])).toMatch(/add a location/i);
  });
});
