import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { inferRemoteType } from "./types";
import { decodeEntities, htmlToText } from "./html";
import { MAX_POSTINGS_PER_BOARD, type CompanyBoard } from "./companyBoards";

// Greenhouse Job Board API: public, no key. `content=true` adds the posting
// body as entity-encoded HTML. https://developers.greenhouse.io/job-board.html
interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string;
  location?: { name?: string } | null;
  content?: string;
  departments?: { name: string }[];
  first_published?: string | null;
  updated_at?: string | null;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export function greenhouseAdapter(board: CompanyBoard): JobSourceAdapter {
  const baseUrl = `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs`;
  return {
    key: `greenhouse:${board.slug}`,
    name: `${board.name} (Greenhouse)`,
    baseUrl,
    kind: "COMPANY_BOARD",

    async fetch(): Promise<NormalizedJobPosting[]> {
      const res = await fetch(`${baseUrl}?content=true`, {
        headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
      });
      if (!res.ok) {
        throw new Error(`Greenhouse (${board.slug}) fetch failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as GreenhouseResponse;

      return data.jobs
        .map((job): NormalizedJobPosting => {
          const location = job.location?.name?.trim() || null;
          const description = htmlToText(decodeEntities(job.content ?? ""));
          const postedAt = job.first_published ?? job.updated_at;
          return {
            externalId: String(job.id),
            title: job.title.trim(),
            company: job.company_name?.trim() || board.name,
            location,
            remoteType: inferRemoteType(`${location ?? ""} ${job.title}`),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            industries: (job.departments ?? []).map((d) => d.name).filter(Boolean),
            description,
            url: job.absolute_url,
            postedAt: postedAt ? new Date(postedAt) : null,
          };
        })
        .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
        .slice(0, MAX_POSTINGS_PER_BOARD);
    },
  };
}
