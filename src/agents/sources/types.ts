export type RemoteType = "REMOTE" | "HYBRID" | "ON_SITE" | "ANY";

export interface NormalizedJobPosting {
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  remoteType: RemoteType;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  industries: string[];
  description: string;
  url: string;
  postedAt: Date | null;
}

export type JobSourceKind = "PUBLIC_API" | "RSS" | "COMPANY_BOARD";

export interface JobSourceAdapter {
  /** Stable key, matches JobSource.key in the DB (e.g. "remotive", "greenhouse:adyen"). */
  key: string;
  name: string;
  baseUrl: string;
  /** Defaults to PUBLIC_API. Company career pages use COMPANY_BOARD. */
  kind?: JobSourceKind;
  /** Fetch the latest postings. Adapters own their own pagination/limits. */
  fetch(): Promise<NormalizedJobPosting[]>;
}

/** Best-effort remote-type inference shared by adapters that only give free text. */
export function inferRemoteType(text: string): RemoteType {
  const t = text.toLowerCase();
  if (/\bhybrid\b/.test(t)) return "HYBRID";
  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(t)) return "REMOTE";
  if (/\bon[-\s]?site\b|\bin[-\s]?office\b/.test(t)) return "ON_SITE";
  return "ANY";
}
