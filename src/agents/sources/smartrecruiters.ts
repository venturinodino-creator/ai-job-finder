import type { JobSourceAdapter, NormalizedJobPosting, RemoteType } from "./types";
import { inferRemoteType } from "./types";
import { fetchJson, mapWithLimit, newestFirst, parseDate } from "./http";
import { htmlToText } from "./html";
import { MAX_POSTINGS_PER_BOARD, type CompanyBoard } from "./companyBoards";

// SmartRecruiters Posting API: public, no key. The list has no job body, so
// the newest postings get one detail request each (see DETAIL_CONCURRENCY).
// https://developers.smartrecruiters.com/docs/posting-api
const DETAIL_CONCURRENCY = 6;

interface SmartListItem {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { fullLocation?: string; remote?: boolean; hybrid?: boolean };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
}

interface SmartList {
  content: SmartListItem[];
}

interface SmartSection {
  title?: string;
  text?: string;
}

interface SmartDetail {
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: { sections?: Record<string, SmartSection | undefined> };
}

const SECTION_ORDER = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"];

export function smartRecruitersBody(detail: SmartDetail | null): string {
  const sections = detail?.jobAd?.sections ?? {};
  return SECTION_ORDER.flatMap((name) => {
    const section = sections[name];
    const text = section?.text ? htmlToText(section.text) : "";
    return text ? [section?.title ? `${section.title}\n${text}` : text] : [];
  }).join("\n\n");
}

function remoteTypeOf(item: SmartListItem): RemoteType {
  if (item.location?.remote) return "REMOTE";
  if (item.location?.hybrid) return "HYBRID";
  return inferRemoteType(`${item.location?.fullLocation ?? ""} ${item.name}`);
}

export function smartRecruitersAdapter(board: CompanyBoard): JobSourceAdapter {
  const baseUrl = `https://api.smartrecruiters.com/v1/companies/${board.slug}/postings`;
  const label = `SmartRecruiters (${board.slug})`;
  return {
    key: `smartrecruiters:${board.slug}`,
    name: `${board.name} (SmartRecruiters)`,
    baseUrl,
    kind: "COMPANY_BOARD",

    async fetch(): Promise<NormalizedJobPosting[]> {
      const list = await fetchJson<SmartList>(label, `${baseUrl}?limit=100`);
      if (!Array.isArray(list.content)) throw new Error(`${label} returned an unexpected payload.`);

      const newest = [...list.content]
        .sort((a, b) => (parseDate(b.releasedDate)?.getTime() ?? 0) - (parseDate(a.releasedDate)?.getTime() ?? 0))
        .slice(0, MAX_POSTINGS_PER_BOARD);

      const postings = await mapWithLimit(newest, DETAIL_CONCURRENCY, async (item): Promise<NormalizedJobPosting> => {
        // A posting whose detail call fails is still worth listing by title.
        const detail = await fetchJson<SmartDetail>(label, `${baseUrl}/${item.id}`).catch(() => null);
        return {
          externalId: item.id,
          title: item.name.trim(),
          company: board.name,
          // fullLocation leaves a hole when a region is missing: "Sydney, , Australia".
          location: item.location?.fullLocation?.replace(/(,\s*)+,/g, ",").trim() || null,
          remoteType: remoteTypeOf(item),
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          industries: [item.department?.label, item.function?.label].filter((s): s is string => Boolean(s)),
          description: smartRecruitersBody(detail) || item.name,
          url: detail?.postingUrl ?? `https://jobs.smartrecruiters.com/${board.slug}/${item.id}`,
          postedAt: parseDate(item.releasedDate),
        };
      });
      return newestFirst(postings);
    },
  };
}
