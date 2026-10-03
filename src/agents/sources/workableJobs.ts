import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { fetchJson, parseDate } from "./http";
import { htmlToText } from "./html";

// Workable's public jobs index (jobs.workable.com) lists open roles from every
// company that uses Workable, newest first. Pages are 20 jobs and are walked
// with the token each response hands back.
const API = "https://jobs.workable.com/api/v1/jobs";
const PAGE_SIZE = 20;
const PAGES = 10;

export interface WorkableIndexJob {
  id: string;
  title: string;
  url: string;
  department?: string;
  description?: string;
  requirementsSection?: string;
  benefitsSection?: string;
  employmentType?: string;
  workplace?: "remote" | "hybrid" | "on_site" | string;
  created?: string;
  location?: { city?: string; subregion?: string; countryName?: string };
  company?: { title?: string };
}

interface WorkableIndexResponse {
  jobs: WorkableIndexJob[];
  nextPageToken?: string;
}

const WORKPLACE_TO_REMOTE: Record<string, RemoteType> = { remote: "REMOTE", hybrid: "HYBRID", on_site: "ON_SITE" };

export function normalizeWorkableIndexJob(job: WorkableIndexJob): NormalizedJobPosting | null {
  if (!job.id || !job.title || !job.url) return null;
  const loc = job.location;
  const location = [loc?.city, loc?.subregion && loc.subregion !== loc.city ? loc.subregion : null, loc?.countryName]
    .filter(Boolean)
    .join(", ");
  const body = [job.description, job.requirementsSection, job.benefitsSection]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map(htmlToText)
    .join("\n\n");
  return {
    externalId: job.id,
    title: job.title.trim(),
    company: job.company?.title?.trim() || "Unknown company",
    location: location || null,
    remoteType: WORKPLACE_TO_REMOTE[job.workplace ?? ""] ?? "ANY",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    industries: [job.department, job.employmentType].filter((s): s is string => Boolean(s)),
    description: body || job.title,
    url: job.url,
    postedAt: parseDate(job.created),
  };
}

export const workableJobsAdapter: JobSourceAdapter = {
  key: "workable-jobs",
  name: "Workable Jobs",
  baseUrl: "https://jobs.workable.com",
  kind: "PUBLIC_API",

  async fetch() {
    const postings: NormalizedJobPosting[] = [];
    let token: string | undefined;
    for (let page = 0; page < PAGES; page++) {
      const url = `${API}?limit=${PAGE_SIZE}${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
      const data = await fetchJson<WorkableIndexResponse>("Workable Jobs", url);
      if (!Array.isArray(data.jobs)) throw new Error("Workable Jobs returned an unexpected payload.");
      for (const job of data.jobs) {
        const posting = normalizeWorkableIndexJob(job);
        if (posting) postings.push(posting);
      }
      token = data.nextPageToken;
      if (!token) break;
    }
    return postings;
  },
};
