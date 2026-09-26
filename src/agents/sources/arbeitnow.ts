import { inferRemoteType, type JobSourceAdapter, type NormalizedJobPosting } from "./types";

// Arbeitnow's public job board API. Free, no key required, no documented
// rate limit but we still only call it once a day from the ingest agent.
// https://www.arbeitnow.com/api/job-board-api
interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number; // unix seconds
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
}

export const arbeitnowAdapter: JobSourceAdapter = {
  key: "arbeitnow",
  name: "Arbeitnow",
  baseUrl: "https://www.arbeitnow.com/api/job-board-api",

  async fetch(): Promise<NormalizedJobPosting[]> {
    const res = await fetch(arbeitnowAdapter.baseUrl, {
      headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
    });
    if (!res.ok) {
      throw new Error(`Arbeitnow fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as ArbeitnowResponse;

    return data.data.map((job): NormalizedJobPosting => ({
      externalId: job.slug,
      title: job.title,
      company: job.company_name,
      location: job.location || null,
      remoteType: job.remote ? "REMOTE" : inferRemoteType(`${job.title} ${job.location}`),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      industries: job.tags ?? [],
      description: stripHtml(job.description),
      url: job.url,
      postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
    }));
  },
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
