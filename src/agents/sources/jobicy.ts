import type { JobSourceAdapter, NormalizedJobPosting } from "./types";

// Jobicy's public API. Free, no key. Their terms: credit Jobicy with a link
// (we show "via Jobicy" and link to the posting) and send applicants to the
// original job URL. https://jobicy.com/api/v2/remote-jobs?get=industries
// lists the valid industry slugs — unknown ones are rejected, not ignored.
//
// The generic pull skews technical, like the other boards. The extra per-
// industry pulls are what bring sales, business-development and account-
// management roles into the pool at all.
const INDUSTRY_PULLS = ["business", "marketing", "supporting"];

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[] | string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: number | string | null;
  annualSalaryMax?: number | string | null;
  salaryCurrency?: string | null;
}

interface JobicyResponse {
  success?: boolean;
  error?: string;
  jobs?: JobicyJob[];
}

export const jobicyAdapter: JobSourceAdapter = {
  key: "jobicy",
  name: "Jobicy",
  baseUrl: "https://jobicy.com/api/v2/remote-jobs",

  async fetch(): Promise<NormalizedJobPosting[]> {
    const byId = new Map<number, JobicyJob>();

    for (const job of await pull("count=100")) byId.set(job.id, job);
    for (const slug of INDUSTRY_PULLS) {
      try {
        for (const job of await pull(`count=50&industry=${slug}`)) byId.set(job.id, job);
      } catch (err) {
        console.warn(`Jobicy industry pull "${slug}" skipped:`, err instanceof Error ? err.message : err);
      }
    }

    return [...byId.values()].map((job): NormalizedJobPosting => {
      const salaryMin = toInt(job.annualSalaryMin);
      const salaryMax = toInt(job.annualSalaryMax);
      return {
        externalId: String(job.id),
        title: job.jobTitle,
        company: job.companyName,
        location: job.jobGeo || null,
        remoteType: "REMOTE", // Jobicy only lists remote roles.
        salaryMin,
        salaryMax,
        salaryCurrency: salaryMin || salaryMax ? (job.salaryCurrency ?? "USD") : null,
        industries: Array.isArray(job.jobIndustry) ? job.jobIndustry : job.jobIndustry ? [job.jobIndustry] : [],
        description: stripHtml(job.jobDescription || job.jobExcerpt || ""),
        url: job.url,
        postedAt: job.pubDate ? new Date(job.pubDate) : null,
      };
    });
  },
};

async function pull(query: string): Promise<JobicyJob[]> {
  const res = await fetch(`${jobicyAdapter.baseUrl}?${query}`, {
    headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
  });
  if (!res.ok) {
    throw new Error(`Jobicy fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as JobicyResponse;
  if (data.success === false) {
    throw new Error(`Jobicy API error: ${data.error ?? "unknown"}`);
  }
  return data.jobs ?? [];
}

function toInt(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "...")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
