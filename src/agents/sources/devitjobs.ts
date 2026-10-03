import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { fetchJson, newestFirst, parseDate } from "./http";

// DevITjobs UK: the public listing endpoint behind devitjobs.uk. It returns
// every open role in one response (a few thousand), so we keep the newest.
const API = "https://devitjobs.uk/api/jobsLight";
const MAX_POSTINGS = 150;

interface DevItJob {
  _id: string;
  jobUrl: string;
  isPaused?: boolean;
  name: string;
  company: string;
  workplace?: "remote" | "hybrid" | "office" | string;
  remoteType?: string;
  actualCity?: string;
  cityCategory?: string;
  activeFrom?: string;
  jobType?: string;
  expLevel?: string;
  annualSalaryFrom?: number;
  annualSalaryTo?: number;
  techCategory?: string;
  technologies?: string[];
  hasVisaSponsorship?: string;
}

const WORKPLACE_TO_REMOTE: Record<string, RemoteType> = { remote: "REMOTE", hybrid: "HYBRID", office: "ON_SITE" };

function titleCaseCity(city: string): string {
  return city.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function normalizeDevItJob(job: DevItJob): NormalizedJobPosting | null {
  if (job.isPaused || !job.jobUrl || !job.name) return null;
  const city = job.actualCity || job.cityCategory;
  const location = city ? `${titleCaseCity(city)}, UK` : "UK";
  const technologies = job.technologies ?? [];
  const from = job.annualSalaryFrom && job.annualSalaryFrom > 0 ? Math.round(job.annualSalaryFrom) : null;
  const to = job.annualSalaryTo && job.annualSalaryTo > 0 ? Math.round(job.annualSalaryTo) : null;
  const facts = [
    job.jobType && `${job.jobType} role`,
    job.expLevel && `${job.expLevel} level`,
    job.workplace && `${job.workplace} workplace`,
    job.hasVisaSponsorship === "Yes" && "visa sponsorship offered",
  ].filter((s): s is string => Boolean(s));
  return {
    externalId: job.jobUrl,
    title: job.name.trim(),
    company: job.company.trim(),
    location,
    remoteType: WORKPLACE_TO_REMOTE[job.workplace ?? ""] ?? "ANY",
    salaryMin: from ?? to,
    salaryMax: to ?? from,
    salaryCurrency: from || to ? "GBP" : null,
    industries: [...new Set([job.techCategory, ...technologies.slice(0, 5)].filter((s): s is string => Boolean(s)))],
    // The listing endpoint has no job body, so describe the role from its facts.
    description:
      `${job.name} at ${job.company}, ${location}. ${facts.join(", ")}.` +
      (technologies.length ? ` Tech stack: ${technologies.join(", ")}.` : ""),
    url: `https://devitjobs.uk/jobs/${job.jobUrl}`,
    postedAt: parseDate(job.activeFrom),
  };
}

export const devItJobsAdapter: JobSourceAdapter = {
  key: "devitjobs",
  name: "DevITjobs UK",
  baseUrl: "https://devitjobs.uk",
  kind: "PUBLIC_API",

  async fetch() {
    const jobs = await fetchJson<DevItJob[]>("DevITjobs UK", API);
    if (!Array.isArray(jobs)) throw new Error("DevITjobs UK returned an unexpected payload.");
    const postings = jobs.flatMap((j) => {
      const p = normalizeDevItJob(j);
      return p ? [p] : [];
    });
    return newestFirst(postings).slice(0, MAX_POSTINGS);
  },
};
