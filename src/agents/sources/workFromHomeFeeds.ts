import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { fetchText, newestFirst, parseDate } from "./http";
import { rssItems, rssText } from "./rss";

// NoDesk and Real Work From Anywhere are small remote-only boards whose RSS
// titles both read "Role at Company".

/** Splits on the last " at " so roles like "Head of Growth at Scale at Acme" keep their wording. */
export function splitRoleAtCompany(raw: string): { title: string; company: string | null } {
  const at = raw.lastIndexOf(" at ");
  if (at <= 0) return { title: raw, company: null };
  return { title: raw.slice(0, at).trim(), company: raw.slice(at + 4).trim() || null };
}

function parseRoleAtCompanyFeed(xml: string): NormalizedJobPosting[] {
  return rssItems(xml).flatMap((item): NormalizedJobPosting[] => {
    const url = rssText(item, "link") ?? rssText(item, "guid");
    const raw = rssText(item, "title");
    if (!url || !raw) return [];
    const { title, company } = splitRoleAtCompany(raw);
    return [
      {
        externalId: rssText(item, "guid") ?? url,
        title,
        company: rssText(item, "author") ?? company ?? "Unknown company",
        location: null,
        remoteType: "REMOTE",
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        industries: [],
        description: rssText(item, "description") ?? title,
        url,
        postedAt: parseDate(rssText(item, "pubDate")),
      },
    ];
  });
}

export const parseNoDesk = parseRoleAtCompanyFeed;
export const parseRealWorkFromAnywhere = parseRoleAtCompanyFeed;

function feedAdapter(key: string, name: string, feed: string, parse: (xml: string) => NormalizedJobPosting[]): JobSourceAdapter {
  return {
    key,
    name,
    baseUrl: feed,
    kind: "RSS",
    async fetch() {
      return newestFirst(parse(await fetchText(name, feed)));
    },
  };
}

export const noDeskAdapter = feedAdapter("nodesk", "NoDesk", "https://nodesk.co/remote-jobs/index.xml", parseNoDesk);
export const realWorkFromAnywhereAdapter = feedAdapter(
  "realworkfromanywhere",
  "Real Work From Anywhere",
  "https://www.realworkfromanywhere.com/rss.xml",
  parseRealWorkFromAnywhere,
);
