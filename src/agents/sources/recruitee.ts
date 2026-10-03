import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { fetchJson, newestFirst, parseDate } from "./http";
import { htmlToText } from "./html";
import { MAX_POSTINGS_PER_BOARD, type CompanyBoard } from "./companyBoards";

// Recruitee careers-site API: public, no key, one subdomain per company.
interface RecruiteeOffer {
  id: number;
  title: string;
  slug?: string;
  careers_url?: string;
  location?: string;
  department?: string;
  description?: string;
  requirements?: string;
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  published_at?: string; // "2026-10-02 13:38:06 UTC"
  salary?: { min?: number | null; max?: number | null; period?: string | null; currency?: string | null } | null;
}

interface RecruiteeResponse {
  offers: RecruiteeOffer[];
}

function remoteTypeOf(offer: RecruiteeOffer): RemoteType {
  if (offer.remote) return "REMOTE";
  if (offer.hybrid) return "HYBRID";
  if (offer.on_site) return "ON_SITE";
  return "ANY";
}

/** Recruitee writes timestamps as "2026-10-02 13:38:06 UTC", which `Date` only reads in ISO form. */
export function parseRecruiteeDate(value: string | undefined): Date | null {
  return parseDate(value?.replace(" UTC", "Z").replace(" ", "T"));
}

export function recruiteeAdapter(board: CompanyBoard): JobSourceAdapter {
  const baseUrl = `https://${board.slug}.recruitee.com/api/offers/`;
  const label = `Recruitee (${board.slug})`;
  return {
    key: `recruitee:${board.slug}`,
    name: `${board.name} (Recruitee)`,
    baseUrl,
    kind: "COMPANY_BOARD",

    async fetch(): Promise<NormalizedJobPosting[]> {
      const data = await fetchJson<RecruiteeResponse>(label, baseUrl);
      if (!Array.isArray(data.offers)) throw new Error(`${label} returned an unexpected payload.`);

      return newestFirst(
        data.offers.map((offer): NormalizedJobPosting => {
          const yearly = offer.salary?.period === "year" && (offer.salary.min || offer.salary.max);
          const body = [offer.description, offer.requirements]
            .filter((s): s is string => Boolean(s && s.trim()))
            .map(htmlToText)
            .join("\n\n");
          return {
            externalId: String(offer.id),
            title: offer.title.trim(),
            company: board.name,
            location: offer.location?.trim() || null,
            remoteType: remoteTypeOf(offer),
            salaryMin: yearly && offer.salary?.min ? Math.round(offer.salary.min) : null,
            salaryMax: yearly && offer.salary?.max ? Math.round(offer.salary.max) : null,
            salaryCurrency: yearly ? (offer.salary?.currency ?? null) : null,
            industries: offer.department ? [offer.department] : [],
            description: body || offer.title,
            url: offer.careers_url ?? `https://${board.slug}.recruitee.com/o/${offer.slug ?? offer.id}`,
            postedAt: parseRecruiteeDate(offer.published_at),
          };
        }),
      ).slice(0, MAX_POSTINGS_PER_BOARD);
    },
  };
}
