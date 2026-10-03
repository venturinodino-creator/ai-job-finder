import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { fetchJson, newestFirst, parseDate } from "./http";
import { htmlToText } from "./html";

// Landing.jobs: public JSON API for tech roles across Portugal and Europe.
// A request returns at most 50 jobs; `offset` pages through the rest.
const API = "https://landing.jobs/api/v1/jobs";
const PAGE_SIZE = 50;
const PAGES = 4;

interface LandingJob {
  id: number;
  title: string;
  url: string;
  type?: string;
  remote?: boolean;
  expires_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  currency_code?: string | null;
  gross_salary_low?: number | null;
  gross_salary_high?: number | null;
  tags?: string[];
  locations?: { city?: string; country_code?: string }[];
  role_description?: string;
  main_requirements?: string;
  nice_to_have?: string;
  perks?: string;
}

/** The posting URL is /at/<company-slug>/…; the API itself has no company field. */
export function companyFromLandingUrl(url: string): string {
  const slug = url.match(/\/at\/([^/]+)/)?.[1];
  if (!slug) return "Landing.jobs";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function normalizeLandingJob(job: LandingJob, now = new Date()): NormalizedJobPosting | null {
  if (job.expires_at && new Date(job.expires_at) < now) return null;
  const location =
    (job.locations ?? [])
      .map((l) => [l.city, l.country_code].filter(Boolean).join(", "))
      .filter(Boolean)
      .join("; ") || null;
  const low = job.gross_salary_low && job.gross_salary_low > 0 ? Math.round(job.gross_salary_low) : null;
  const high = job.gross_salary_high && job.gross_salary_high > 0 ? Math.round(job.gross_salary_high) : null;
  const body = [job.role_description, job.main_requirements, job.nice_to_have, job.perks]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map(htmlToText)
    .join("\n\n");
  return {
    externalId: String(job.id),
    title: job.title.trim(),
    company: companyFromLandingUrl(job.url),
    location,
    remoteType: job.remote ? "REMOTE" : "ANY",
    salaryMin: low ?? high,
    salaryMax: high ?? low,
    salaryCurrency: low || high ? (job.currency_code ?? null) : null,
    industries: job.tags ?? [],
    description: body || job.title,
    url: job.url,
    postedAt: parseDate(job.published_at ?? job.created_at),
  };
}

export const landingJobsAdapter: JobSourceAdapter = {
  key: "landingjobs",
  name: "Landing.jobs",
  baseUrl: "https://landing.jobs",
  kind: "PUBLIC_API",

  async fetch() {
    const postings: NormalizedJobPosting[] = [];
    for (let page = 0; page < PAGES; page++) {
      const jobs = await fetchJson<LandingJob[]>("Landing.jobs", `${API}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
      if (!Array.isArray(jobs)) throw new Error("Landing.jobs returned an unexpected payload.");
      for (const job of jobs) {
        const posting = normalizeLandingJob(job);
        if (posting) postings.push(posting);
      }
      if (jobs.length < PAGE_SIZE) break;
    }
    return newestFirst(postings);
  },
};
