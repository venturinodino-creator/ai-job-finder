import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { htmlToText } from "./html";

// Himalayas public jobs feed: remote-only, no key, newest first.
// https://himalayas.app/jobs/api
interface HimalayasJob {
  guid: string;
  title: string;
  companyName: string;
  applicationLink: string;
  description?: string;
  excerpt?: string;
  categories?: string[];
  parentCategories?: string[];
  locationRestrictions?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null; // "yearly" | "monthly" | "hourly" | ...
  currency?: string | null;
  pubDate?: number; // epoch seconds
}

interface HimalayasResponse {
  jobs: HimalayasJob[];
  nextCursor?: string | null;
}

// The API serves 20 per page and prefers cursor pagination; five pages of
// the newest postings is plenty for a daily pull.
const PAGE_LIMIT = 20;
const MAX_PAGES = 5;

export const himalayasAdapter: JobSourceAdapter = {
  key: "himalayas",
  name: "Himalayas",
  baseUrl: "https://himalayas.app/jobs/api",

  async fetch(): Promise<NormalizedJobPosting[]> {
    const jobs: HimalayasJob[] = [];
    let cursor: string | null | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${himalayasAdapter.baseUrl}?limit=${PAGE_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url, { headers: { "User-Agent": "ai-job-finder (+https://github.com/)" } });
      if (!res.ok) {
        throw new Error(`Himalayas fetch failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as HimalayasResponse;
      jobs.push(...(data.jobs ?? []));
      cursor = data.nextCursor;
      if (!cursor || (data.jobs ?? []).length === 0) break;
    }

    return jobs.map((job): NormalizedJobPosting => {
      const yearly = job.salaryPeriod === "yearly";
      const salaryMin = yearly && job.minSalary ? Math.round(job.minSalary) : null;
      const salaryMax = yearly && job.maxSalary ? Math.round(job.maxSalary) : null;
      return {
        externalId: job.guid,
        title: job.title.trim(),
        company: job.companyName?.trim() || "Unknown company",
        location: job.locationRestrictions?.length ? job.locationRestrictions.join(", ") : "Remote (worldwide)",
        remoteType: "REMOTE",
        salaryMin,
        salaryMax,
        salaryCurrency: salaryMin || salaryMax ? (job.currency ?? "USD") : null,
        industries: [...(job.parentCategories ?? []), ...(job.categories ?? [])].map((c) => c.replace(/-/g, " ")),
        description: htmlToText(job.description ?? job.excerpt ?? ""),
        url: job.applicationLink,
        postedAt: job.pubDate ? new Date(job.pubDate * 1000) : null,
      };
    });
  },
};
