import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { fetchText, newestFirst, parseDate } from "./http";
import { rssItems, rssText } from "./rss";

// We Work Remotely publishes one public RSS feed per category plus an "all"
// feed that only carries the latest few dozen, so the categories are read too.
const BASE = "https://weworkremotely.com";
const FEEDS = [
  "/remote-jobs.rss",
  "/categories/remote-programming-jobs.rss",
  "/categories/remote-design-jobs.rss",
  "/categories/remote-customer-support-jobs.rss",
  "/categories/remote-devops-sysadmin-jobs.rss",
  "/categories/remote-product-jobs.rss",
  "/categories/remote-sales-and-marketing-jobs.rss",
  "/categories/remote-management-and-finance-jobs.rss",
  "/categories/all-other-remote-jobs.rss",
];

/** Titles read "Company: Role"; a title without the prefix keeps the whole string. */
export function splitCompanyTitle(raw: string): { company: string; title: string } {
  const at = raw.indexOf(": ");
  if (at <= 0) return { company: "Unknown company", title: raw };
  return { company: raw.slice(0, at).trim(), title: raw.slice(at + 2).trim() };
}

export function parseWeWorkRemotely(xml: string): NormalizedJobPosting[] {
  return rssItems(xml).flatMap((item): NormalizedJobPosting[] => {
    const url = rssText(item, "link") ?? rssText(item, "guid");
    const raw = rssText(item, "title");
    if (!url || !raw) return [];
    const { company, title } = splitCompanyTitle(raw);
    const region = rssText(item, "region");
    const category = rssText(item, "category");
    const type = rssText(item, "type");
    return [
      {
        externalId: url,
        title,
        company,
        location: region,
        remoteType: "REMOTE",
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        industries: [category, type].filter((s): s is string => Boolean(s)),
        description: rssText(item, "description") ?? title,
        url,
        postedAt: parseDate(rssText(item, "pubDate")),
      },
    ];
  });
}

export const weWorkRemotelyAdapter: JobSourceAdapter = {
  key: "weworkremotely",
  name: "We Work Remotely",
  baseUrl: `${BASE}/remote-jobs.rss`,
  kind: "RSS",

  async fetch() {
    const results = await Promise.allSettled(FEEDS.map((path) => fetchText("We Work Remotely", `${BASE}${path}`)));
    const feeds = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (feeds.length === 0) {
      const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      throw first?.reason instanceof Error ? first.reason : new Error("We Work Remotely fetch failed");
    }
    // The same posting appears in "all" and its category; ingest also de-dupes, but cheaper here.
    const unique = new Map<string, NormalizedJobPosting>();
    for (const posting of feeds.flatMap(parseWeWorkRemotely)) unique.set(posting.externalId, posting);
    return newestFirst([...unique.values()]);
  },
};
