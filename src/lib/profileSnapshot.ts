/**
 * The match-relevant slice of a search profile. Used to decide whether a
 * profile save should trigger a re-score, and as the payload stored in the
 * search-history archive. Pure: no DB access.
 */

export interface ProfileSnapshot {
  targetRoles: string[];
  locations: string[];
  remotePref: string;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  expectsCommission: boolean;
  industries: string[];
  languages: string[];
  activeCvId: string | null;
}

type ProfileLike = {
  targetRoles: string[];
  locations: string[];
  remotePref: string;
  seniority?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  expectsCommission?: boolean;
  industries: string[];
  languages: string[];
  activeCvId?: string | null;
};

export function profileSnapshot(p: ProfileLike): ProfileSnapshot {
  return {
    targetRoles: normList(p.targetRoles),
    locations: normList(p.locations),
    remotePref: p.remotePref,
    seniority: p.seniority ?? null,
    salaryMin: p.salaryMin ?? null,
    salaryMax: p.salaryMax ?? null,
    salaryCurrency: p.salaryCurrency ?? null,
    expectsCommission: p.expectsCommission ?? false,
    industries: normList(p.industries),
    languages: normList(p.languages),
    activeCvId: p.activeCvId ?? null,
  };
}

/** True when anything that feeds the match agent differs between the two. */
export function snapshotsDiffer(a: ProfileSnapshot, b: ProfileSnapshot): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

const REMOTE_LABEL: Record<string, string> = {
  REMOTE: "remote",
  HYBRID: "hybrid",
  ON_SITE: "on-site",
  ANY: "any location type",
};

/** One-line summary for the archive card, e.g. "Account Manager · Netherlands, EU · remote · senior". */
export function describeSnapshot(s: ProfileSnapshot): string {
  const parts: string[] = [];
  parts.push(s.targetRoles.length ? s.targetRoles.slice(0, 3).join(" / ") : "Any role");
  if (s.locations.length) parts.push(s.locations.slice(0, 3).join(", "));
  parts.push(REMOTE_LABEL[s.remotePref] ?? s.remotePref.toLowerCase());
  if (s.seniority) parts.push(s.seniority.toLowerCase());
  if (s.salaryMin || s.salaryMax) {
    const cur = s.salaryCurrency ?? "";
    const range = s.salaryMin && s.salaryMax ? `${fmt(s.salaryMin)}–${fmt(s.salaryMax)}` : fmt(s.salaryMin ?? s.salaryMax ?? 0);
    parts.push(`${cur} ${range}`.trim());
  }
  if (s.industries.length) parts.push(s.industries.slice(0, 2).join(", "));
  return parts.join(" · ");
}

function normList(list: string[]): string[] {
  return list.map((s) => s.trim()).filter(Boolean);
}

function fmt(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}
