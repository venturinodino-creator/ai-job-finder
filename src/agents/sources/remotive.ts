import type { JobSourceAdapter, NormalizedJobPosting } from "./types";

// Remotive's public API. Free, no key required. Their terms ask that you
// (a) link back to the job's Remotive URL and (b) not poll more than ~4x/day —
// our daily ingest agent comfortably respects that. https://remotive.com/api-documentation
interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  tags: string[];
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export const remotiveAdapter: JobSourceAdapter = {
  key: "remotive",
  name: "Remotive",
  baseUrl: "https://remotive.com/api/remote-jobs",

  async fetch(): Promise<NormalizedJobPosting[]> {
    const res = await fetch(`${remotiveAdapter.baseUrl}?limit=100`, {
      headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
    });
    if (!res.ok) {
      throw new Error(`Remotive fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as RemotiveResponse;

    return data.jobs.map((job): NormalizedJobPosting => ({
      externalId: String(job.id),
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || null,
      remoteType: "REMOTE", // Remotive only lists remote roles.
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      industries: job.tags ?? [],
      description: stripHtml(job.description),
      url: job.url,
      postedAt: job.publication_date ? new Date(job.publication_date) : null,
    }));
  },
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
