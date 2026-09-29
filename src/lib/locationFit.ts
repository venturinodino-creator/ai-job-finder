import type { RemotePreference } from "@/generated/prisma/client";

/**
 * How a posting's location sits against the search profile.
 * - match:         the posting is in one of the profile's locations
 * - remote:        the posting is fully remote, so its office location is moot
 * - unknown:       the posting doesn't say where it is
 * - outside:       the posting names a place that isn't in the profile
 * - unconstrained: the profile lists no locations
 */
export type LocationFit = "match" | "remote" | "unknown" | "outside" | "unconstrained";

/** Points taken off an "outside" posting when the candidate needs to be near the office. */
export const OUTSIDE_LOCATION_PENALTY = 25;

// Profile locations are free text ("south africa", "NL", "Berlin"), postings
// name cities, countries or codes. Each region lists the spellings, cities
// and codes that count as being inside it. Codes of three letters or fewer
// only match as whole words, so "de" never matches "Denver".
const REGIONS: Record<string, string[]> = {
  "south africa": ["south africa", "za", "rsa", "cape town", "johannesburg", "joburg", "pretoria", "durban", "sandton", "centurion", "stellenbosch", "gauteng", "western cape"],
  netherlands: ["netherlands", "the netherlands", "nl", "holland", "amsterdam", "rotterdam", "utrecht", "eindhoven", "the hague", "den haag", "groningen", "leiden", "delft"],
  belgium: ["belgium", "be", "brussels", "bruxelles", "antwerp", "antwerpen", "ghent", "gent", "leuven"],
  germany: ["germany", "deutschland", "de", "berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln", "stuttgart", "düsseldorf", "dusseldorf"],
  "united kingdom": ["united kingdom", "uk", "great britain", "england", "scotland", "wales", "london", "manchester", "bristol", "birmingham", "edinburgh", "glasgow", "leeds", "cambridge", "oxford"],
  ireland: ["ireland", "ie", "dublin", "cork", "galway"],
  france: ["france", "fr", "paris", "lyon", "marseille", "toulouse", "bordeaux"],
  spain: ["spain", "es", "españa", "madrid", "barcelona", "valencia", "malaga", "málaga"],
  portugal: ["portugal", "pt", "lisbon", "lisboa", "porto"],
  italy: ["italy", "it", "italia", "milan", "milano", "rome", "roma", "turin"],
  switzerland: ["switzerland", "ch", "zurich", "zürich", "geneva", "basel", "bern"],
  austria: ["austria", "at", "vienna", "wien"],
  denmark: ["denmark", "dk", "copenhagen", "københavn", "aarhus"],
  sweden: ["sweden", "se", "stockholm", "gothenburg", "malmö", "malmo"],
  norway: ["norway", "no", "oslo", "bergen"],
  finland: ["finland", "fi", "helsinki"],
  poland: ["poland", "pl", "warsaw", "warszawa", "krakow", "kraków", "wroclaw", "wrocław"],
  "united arab emirates": ["united arab emirates", "uae", "dubai", "abu dhabi"],
  "united states": ["united states", "usa", "us", "america", "new york", "nyc", "san francisco", "bay area", "los angeles", "austin", "seattle", "boston", "chicago", "denver", "miami", "atlanta", "washington"],
  canada: ["canada", "ca", "toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary"],
  australia: ["australia", "au", "sydney", "melbourne", "brisbane", "perth"],
  india: ["india", "in", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai"],
  singapore: ["singapore", "sg"],
};

const EUROPE = ["netherlands", "belgium", "germany", "united kingdom", "ireland", "france", "spain", "portugal", "italy", "switzerland", "austria", "denmark", "sweden", "norway", "finland", "poland"];
const REGION_GROUPS: Record<string, string[]> = {
  eu: EUROPE,
  europe: EUROPE,
  emea: [...EUROPE, "south africa", "united arab emirates"],
  benelux: ["netherlands", "belgium"],
  dach: ["germany", "austria", "switzerland"],
  nordics: ["denmark", "sweden", "norway", "finland"],
};

const REMOTE_WORDS = /\b(remote|anywhere|worldwide|work from home|wfh|distributed)\b/;

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function wordTokens(text: string): Set<string> {
  return new Set(text.split(/[^a-zà-ÿ0-9]+/).filter(Boolean));
}

/** True when `place` (a posting location) falls inside `region` (a profile location). */
export function placeMatchesRegion(place: string, region: string): boolean {
  const p = normalise(place);
  const r = normalise(region);
  if (!p || !r) return false;
  const tokens = wordTokens(p);
  const matchesAlias = (alias: string) => (alias.length <= 3 ? tokens.has(alias) : p.includes(alias));

  // A named group ("EU", "Nordics") stands for every region in it.
  const group = REGION_GROUPS[r];
  if (group) return group.some((key) => REGIONS[key].some(matchesAlias));

  // A known region: any of its spellings, cities or codes.
  const key = Object.keys(REGIONS).find((k) => k === r || REGIONS[k].includes(r));
  if (key) return REGIONS[key].some(matchesAlias);

  // Unknown free text: plain containment, whole-word for short strings.
  return r.length <= 3 ? tokens.has(r) : p.includes(r);
}

export function locationFit(
  profileLocations: string[],
  jobLocation: string | null,
  jobRemoteType: RemotePreference | string,
): LocationFit {
  const wanted = profileLocations.map(normalise).filter(Boolean);
  if (wanted.length === 0) return "unconstrained";
  if (jobLocation && wanted.some((region) => placeMatchesRegion(jobLocation, region))) return "match";
  if (jobRemoteType === "REMOTE" || (jobLocation && REMOTE_WORDS.test(normalise(jobLocation)))) return "remote";
  if (!jobLocation || !normalise(jobLocation)) return "unknown";
  return "outside";
}

/**
 * Whether a posting should be marked and penalised as outside the candidate's
 * locations: only when they need to be near the office (on-site or hybrid) and
 * the posting names somewhere else. Remote-friendly profiles keep location
 * as a soft preference.
 */
export function isLocationMismatch(
  profileLocations: string[],
  remotePref: RemotePreference | string,
  jobLocation: string | null,
  jobRemoteType: RemotePreference | string,
): boolean {
  if (remotePref !== "ON_SITE" && remotePref !== "HYBRID") return false;
  return locationFit(profileLocations, jobLocation, jobRemoteType) === "outside";
}
