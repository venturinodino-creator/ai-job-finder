import { OUTSIDE_LOCATION_PENALTY } from "@/lib/locationFit";
import type { RemotePreference, Seniority } from "@/generated/prisma/client";

// The search profile's options in plain words, and the one line that says
// what the remote preference does to scoring. Pure: no React, no database.

export const REMOTE_LABELS: Record<RemotePreference, string> = {
  ANY: "Any",
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ON_SITE: "On-site",
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  INTERN: "Intern",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  STAFF: "Staff",
  PRINCIPAL: "Principal",
  MANAGER: "Manager",
  DIRECTOR: "Director",
  EXECUTIVE: "Executive",
};

/** The order the remote preference is offered in. */
export const REMOTE_ORDER: RemotePreference[] = ["ANY", "REMOTE", "HYBRID", "ON_SITE"];

/** The order seniorities are offered in, junior to senior. */
export const SENIORITY_ORDER: Seniority[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "STAFF", "PRINCIPAL", "MANAGER", "DIRECTOR", "EXECUTIVE"];

/** What the chosen remote preference does to scoring, in one line. */
export function remoteRule(pref: RemotePreference, locations: string[]): string {
  if (pref === "ON_SITE" || pref === "HYBRID") {
    return locations.length === 0
      ? "You need to be near the office, but no location is listed. Add a location, or nothing can be docked."
      : `Postings outside your locations lose ${OUTSIDE_LOCATION_PENALTY} points and are tagged "Outside your locations".`;
  }
  return "Location is a soft preference: postings elsewhere are not docked.";
}
