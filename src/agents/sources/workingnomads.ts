import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { htmlToText } from "./html";

// Working Nomads exposes its most recent remote postings as a plain JSON
// list, no key. Small feed (~50 jobs), but a different mix from the others.
// https://www.workingnomads.com/api/exposed_jobs/
interface WorkingNomadsJob {
  url: string;
  title: string;
  description?: string;
  company_name?: string;
  category_name?: string;
  tags?: string;
  location?: string;
  pub_date?: string;
}

export const workingNomadsAdapter: JobSourceAdapter = {
  key: "workingnomads",
  name: "Working Nomads",
  baseUrl: "https://www.workingnomads.com/api/exposed_jobs/",

  async fetch(): Promise<NormalizedJobPosting[]> {
    const res = await fetch(workingNomadsAdapter.baseUrl, {
      headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
    });
    if (!res.ok) {
      throw new Error(`Working Nomads fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as WorkingNomadsJob[];
    if (!Array.isArray(data)) {
      throw new Error("Working Nomads returned an unexpected payload.");
    }

    return data.map((job): NormalizedJobPosting => ({
      externalId: job.url,
      title: job.title.trim(),
      company: job.company_name?.trim() || "Unknown company",
      location: job.location?.trim() || "Remote",
      remoteType: "REMOTE",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      industries: [job.category_name, ...(job.tags ?? "").split(",")].map((t) => (t ?? "").trim()).filter(Boolean),
      description: htmlToText(job.description ?? ""),
      url: job.url,
      postedAt: job.pub_date ? new Date(job.pub_date) : null,
    }));
  },
};
