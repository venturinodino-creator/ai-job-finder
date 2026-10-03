import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { fetchText, newestFirst, parseDate } from "./http";
import { rssHtml, rssItems, rssText } from "./rss";
import { htmlToText } from "./html";

// Jobspresso is a WordPress job board; its public job_listing feed carries the
// full posting body in content:encoded. The company and location share the
// dc:creator tag, separated by a <br>: "Hopper<br>⚲ Various US States".
const FEED = "https://jobspresso.co/feed/?post_type=job_listing";
const PAGES = 3;

export function parseJobspresso(xml: string): NormalizedJobPosting[] {
  return rssItems(xml).flatMap((item): NormalizedJobPosting[] => {
    const url = rssText(item, "link");
    const title = rssText(item, "title");
    if (!url || !title) return [];
    const [companyPart, locationPart] = (rssHtml(item, "dc:creator") ?? "").split(/<br\s*\/?>/i);
    const company = htmlToText(companyPart ?? "") || "Unknown company";
    const location = htmlToText(locationPart ?? "").replace(/^⚲\s*/, "").trim() || null;
    return [
      {
        externalId: rssText(item, "guid") ?? url,
        title,
        company,
        location,
        remoteType: "REMOTE",
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        industries: [],
        description: rssText(item, "content:encoded") ?? rssText(item, "description") ?? title,
        url,
        postedAt: parseDate(rssText(item, "pubDate")),
      },
    ];
  });
}

export const jobspressoAdapter: JobSourceAdapter = {
  key: "jobspresso",
  name: "Jobspresso",
  baseUrl: FEED,
  kind: "RSS",

  async fetch() {
    const postings: NormalizedJobPosting[] = [];
    for (let page = 1; page <= PAGES; page++) {
      // WordPress answers a page past the end with an error; keep what we have by then.
      let xml: string;
      try {
        xml = await fetchText("Jobspresso", page === 1 ? FEED : `${FEED}&paged=${page}`);
      } catch (err) {
        if (page === 1) throw err;
        break;
      }
      const batch = parseJobspresso(xml);
      if (batch.length === 0) break;
      postings.push(...batch);
    }
    return newestFirst(postings);
  },
};
