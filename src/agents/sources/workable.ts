import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { inferRemoteType } from "./types";
import { fetchJson, newestFirst, parseDate } from "./http";
import { htmlToText } from "./html";
import { MAX_POSTINGS_PER_BOARD, type CompanyBoard } from "./companyBoards";

// Workable account widget: public, no key. `details=true` adds each job's body.
interface WorkableJob {
  shortcode: string;
  title: string;
  url: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  function?: string;
  city?: string;
  state?: string;
  country?: string;
  published_on?: string;
  created_at?: string;
  description?: string;
}

interface WorkableResponse {
  jobs: WorkableJob[];
}

export function workableAdapter(board: CompanyBoard): JobSourceAdapter {
  const baseUrl = `https://apply.workable.com/api/v1/widget/accounts/${board.slug}`;
  const label = `Workable (${board.slug})`;
  return {
    key: `workable:${board.slug}`,
    name: `${board.name} (Workable)`,
    baseUrl,
    kind: "COMPANY_BOARD",

    async fetch(): Promise<NormalizedJobPosting[]> {
      const data = await fetchJson<WorkableResponse>(label, `${baseUrl}?details=true`);
      if (!Array.isArray(data.jobs)) throw new Error(`${label} returned an unexpected payload.`);

      // A job open in several locations comes back once per location with the same shortcode.
      const distinct = new Map<string, WorkableJob>();
      for (const job of data.jobs) if (!distinct.has(job.shortcode)) distinct.set(job.shortcode, job);

      return newestFirst(
        [...distinct.values()].map((job): NormalizedJobPosting => {
          const location = [job.city, job.state, job.country].filter(Boolean).join(", ") || null;
          return {
            externalId: job.shortcode,
            title: job.title.trim(),
            company: board.name,
            location,
            remoteType: job.telecommuting ? "REMOTE" : inferRemoteType(`${location ?? ""} ${job.title}`),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            industries: [job.department, job.function].filter((s): s is string => Boolean(s)),
            description: job.description ? htmlToText(job.description) : job.title,
            url: job.url,
            postedAt: parseDate(job.published_on ?? job.created_at),
          };
        }),
      ).slice(0, MAX_POSTINGS_PER_BOARD);
    },
  };
}
