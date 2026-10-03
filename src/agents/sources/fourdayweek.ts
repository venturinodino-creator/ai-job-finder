import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { fetchJson, newestFirst } from "./http";

// 4 Day Week: public JSON API listing roles at companies that run a shorter
// working week. 25 jobs per page, newest first.
const API = "https://4dayweek.io/api/jobs";
const PAGES = 8;

interface FourDayJob {
  id: string;
  title: string;
  slug: string;
  company_name: string;
  work_arrangement?: "remote" | "hybrid" | "onsite" | string;
  locations?: { city?: string; state?: string; country?: string; is_primary?: boolean }[];
  posted?: number; // epoch seconds
  schedule_type?: string;
  category?: string;
  level?: string;
  is_expired?: boolean;
}

interface FourDayResponse {
  jobs: FourDayJob[];
  has_more?: boolean;
}

const ARRANGEMENT_TO_REMOTE: Record<string, RemoteType> = { remote: "REMOTE", hybrid: "HYBRID", onsite: "ON_SITE" };

const words = (value: string) => value.replace(/_/g, " ");

export function normalizeFourDayJob(job: FourDayJob): NormalizedJobPosting | null {
  if (job.is_expired || !job.slug || !job.title) return null;
  const primary = (job.locations ?? []).find((l) => l.is_primary) ?? job.locations?.[0];
  const location = primary ? [primary.city, primary.state, primary.country].filter(Boolean).join(", ") || null : null;
  const schedule = job.schedule_type ? words(job.schedule_type) : "4 day week";
  const facts = [job.level && `${job.level} level`, job.category && `${words(job.category)} team`, job.work_arrangement]
    .filter((s): s is string => Boolean(s))
    .join(", ");
  return {
    externalId: job.id,
    title: job.title.trim(),
    company: job.company_name.trim(),
    location,
    remoteType: ARRANGEMENT_TO_REMOTE[job.work_arrangement ?? ""] ?? "ANY",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    industries: job.category ? [words(job.category)] : [],
    // The list endpoint has no job body; the schedule is the point of this board.
    description: `${job.title} at ${job.company_name}${location ? `, ${location}` : ""}. Works a shorter week (${schedule}). ${facts}.`,
    url: `https://4dayweek.io/job/${job.slug}`,
    postedAt: job.posted ? new Date(job.posted * 1000) : null,
  };
}

export const fourDayWeekAdapter: JobSourceAdapter = {
  key: "4dayweek",
  name: "4 Day Week",
  baseUrl: "https://4dayweek.io",
  kind: "PUBLIC_API",

  async fetch() {
    const postings: NormalizedJobPosting[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const data = await fetchJson<FourDayResponse>("4 Day Week", `${API}?page=${page}`);
      if (!Array.isArray(data.jobs)) throw new Error("4 Day Week returned an unexpected payload.");
      for (const job of data.jobs) {
        const posting = normalizeFourDayJob(job);
        if (posting) postings.push(posting);
      }
      if (!data.has_more) break;
    }
    return newestFirst(postings);
  },
};
