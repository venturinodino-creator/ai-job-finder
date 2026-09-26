import type { JobSourceAdapter, NormalizedJobPosting } from "./types";

// RemoteOK's public API. Free, no key required. Their terms ask that you
// link back to the job's RemoteOK URL and mention RemoteOK as the source.
// A browser-like User-Agent is required or the API returns an empty body.
interface RemoteOkJob {
  id: string;
  slug: string;
  company: string;
  position: string;
  tags: string[];
  description: string;
  location: string;
  url: string;
  date: string;
  salary_min?: number;
  salary_max?: number;
}

export const remoteokAdapter: JobSourceAdapter = {
  key: "remoteok",
  name: "RemoteOK",
  baseUrl: "https://remoteok.com/api",

  async fetch(): Promise<NormalizedJobPosting[]> {
    const res = await fetch(remoteokAdapter.baseUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (ai-job-finder; +https://github.com/)" },
    });
    if (!res.ok) {
      throw new Error(`RemoteOK fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as unknown[];

    // The first element is a legal/metadata notice, not a job.
    const jobs = data.filter((entry): entry is RemoteOkJob => {
      const j = entry as Partial<RemoteOkJob>;
      return typeof j.id === "string" && typeof j.position === "string";
    });

    return jobs.map((job): NormalizedJobPosting => ({
      externalId: job.id,
      title: job.position,
      company: job.company,
      location: job.location || null,
      remoteType: "REMOTE", // RemoteOK only lists remote roles.
      salaryMin: job.salary_min ?? null,
      salaryMax: job.salary_max ?? null,
      salaryCurrency: job.salary_min || job.salary_max ? "USD" : null,
      industries: job.tags ?? [],
      description: stripHtml(job.description ?? ""),
      url: job.url,
      postedAt: job.date ? new Date(job.date) : null,
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
