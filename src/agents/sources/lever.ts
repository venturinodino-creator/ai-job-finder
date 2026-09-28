import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { inferRemoteType } from "./types";
import { htmlToText } from "./html";
import { MAX_POSTINGS_PER_BOARD, type CompanyBoard } from "./companyBoards";

// Lever Postings API: public, no key. https://github.com/lever/postings-api
interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number; // epoch ms
  workplaceType?: "remote" | "hybrid" | "onsite" | "unspecified" | string;
  categories?: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
    allLocations?: string[];
  };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string } | null;
}

const WORKPLACE_TO_REMOTE: Record<string, RemoteType> = {
  remote: "REMOTE",
  hybrid: "HYBRID",
  onsite: "ON_SITE",
};

export function leverAdapter(board: CompanyBoard): JobSourceAdapter {
  const baseUrl = `https://api.lever.co/v0/postings/${board.slug}`;
  return {
    key: `lever:${board.slug}`,
    name: `${board.name} (Lever)`,
    baseUrl,
    kind: "COMPANY_BOARD",

    async fetch(): Promise<NormalizedJobPosting[]> {
      const res = await fetch(`${baseUrl}?mode=json`, {
        headers: { "User-Agent": "ai-job-finder (+https://github.com/)" },
      });
      if (!res.ok) {
        throw new Error(`Lever (${board.slug}) fetch failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as LeverPosting[];
      if (!Array.isArray(data)) {
        throw new Error(`Lever (${board.slug}) returned an unexpected payload.`);
      }

      return data
        .map((job): NormalizedJobPosting => {
          const locations = job.categories?.allLocations?.length
            ? job.categories.allLocations
            : job.categories?.location
              ? [job.categories.location]
              : [];
          const location = locations.join(", ") || null;
          const lists = (job.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
          const description = [job.descriptionPlain, lists, job.additionalPlain]
            .filter((s): s is string => Boolean(s && s.trim()))
            .join("\n\n")
            .trim();
          const yearly = job.salaryRange && (job.salaryRange.interval ?? "per-year-salary").includes("year");
          return {
            externalId: job.id,
            title: job.text.trim(),
            company: board.name,
            location,
            remoteType:
              WORKPLACE_TO_REMOTE[job.workplaceType ?? ""] ?? inferRemoteType(`${location ?? ""} ${job.text}`),
            salaryMin: yearly && job.salaryRange?.min ? Math.round(job.salaryRange.min) : null,
            salaryMax: yearly && job.salaryRange?.max ? Math.round(job.salaryRange.max) : null,
            salaryCurrency: yearly && (job.salaryRange?.min || job.salaryRange?.max) ? (job.salaryRange?.currency ?? null) : null,
            industries: [job.categories?.department, job.categories?.team].filter((s): s is string => Boolean(s)),
            description,
            url: job.hostedUrl,
            postedAt: job.createdAt ? new Date(job.createdAt) : null,
          };
        })
        .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
        .slice(0, MAX_POSTINGS_PER_BOARD);
    },
  };
}
