import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { inferRemoteType } from "./types";
import { htmlToText } from "./html";
import { MAX_POSTINGS_PER_BOARD, type CompanyBoard } from "./companyBoards";

// Ashby Job Posting API: public, no key. Used by OpenAI, Notion, Cohere, etc.
// https://developers.ashbyhq.com/reference/jobpostingapi
interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  department?: string;
  team?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  isListed?: boolean;
  workplaceType?: "Remote" | "Hybrid" | "OnSite" | string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  compensation?: {
    compensationTierSummary?: string | null;
    scrapeableCompensationSalarySummary?: string | null;
  };
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

const WORKPLACE_TO_REMOTE: Record<string, RemoteType> = {
  Remote: "REMOTE",
  Hybrid: "HYBRID",
  OnSite: "ON_SITE",
};

export function ashbyAdapter(board: CompanyBoard): JobSourceAdapter {
  const baseUrl = `https://api.ashbyhq.com/posting-api/job-board/${board.slug}`;
  return {
    key: `ashby:${board.slug}`,
    name: `${board.name} (Ashby)`,
    baseUrl,
    kind: "COMPANY_BOARD",

    async fetch(): Promise<NormalizedJobPosting[]> {
      const res = await fetch(`${baseUrl}?includeCompensation=true`, {
        headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
      });
      if (!res.ok) {
        throw new Error(`Ashby (${board.slug}) fetch failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as AshbyResponse;

      return (data.jobs ?? [])
        .filter((job) => job.isListed !== false)
        .map((job): NormalizedJobPosting => {
          const locations = [job.location, ...(job.secondaryLocations ?? []).map((l) => l.location)].filter(
            (s): s is string => Boolean(s && s.trim()),
          );
          const location = locations.join(", ") || null;
          const compensation =
            job.compensation?.scrapeableCompensationSalarySummary || job.compensation?.compensationTierSummary;
          const body = job.descriptionPlain?.trim() || htmlToText(job.descriptionHtml ?? "");
          return {
            externalId: job.id,
            title: job.title.trim(),
            company: board.name,
            location,
            remoteType: job.isRemote
              ? "REMOTE"
              : (WORKPLACE_TO_REMOTE[job.workplaceType ?? ""] ?? inferRemoteType(`${location ?? ""} ${job.title}`)),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            industries: [job.department, job.team].filter((s): s is string => Boolean(s)),
            description: compensation ? `Compensation: ${compensation}\n\n${body}` : body,
            url: job.jobUrl,
            postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
          };
        })
        .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
        .slice(0, MAX_POSTINGS_PER_BOARD);
    },
  };
}
