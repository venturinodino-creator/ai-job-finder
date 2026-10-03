import type { JobSourceAdapter, NormalizedJobPosting } from "./types";
import { inferRemoteType } from "./types";
import { fetchJson, mapWithLimit } from "./http";

// Hacker News "Jobs" (news.ycombinator.com/jobs): the official Firebase API
// lists the ids of the current job stories, and each story is a title plus
// the company's own posting URL. https://github.com/HackerNews/API
const API = "https://hacker-news.firebaseio.com/v0";
const MAX_STORIES = 60;
const STORY_CONCURRENCY = 8;

interface HnStory {
  id: number;
  by?: string;
  time?: number; // epoch seconds
  title?: string;
  url?: string;
  type?: string;
  dead?: boolean;
  deleted?: boolean;
}

/** "Truemetrics (YC S23) Is Hiring a GTM Founder's Associate" → "Truemetrics". */
export function companyFromHnTitle(title: string): string {
  const match = title.match(/^(.+?)\s*(?:\((?:YC|Y Combinator)[^)]*\)\s*)?(?:is|are)?\s*(?:hiring|looking for|seeks)\b/i);
  const company = match?.[1]?.replace(/\s*\((?:YC|Y Combinator)[^)]*\)\s*$/i, "").trim();
  return company && company.length <= 60 ? company : "Hacker News";
}

export function normalizeHnStory(story: HnStory): NormalizedJobPosting | null {
  if (story.dead || story.deleted || story.type !== "job" || !story.title) return null;
  const title = story.title.trim();
  return {
    externalId: String(story.id),
    title,
    company: companyFromHnTitle(title),
    location: null,
    remoteType: inferRemoteType(title),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    industries: [],
    // Job stories carry no body, only a title and a link to the company's page.
    description: `${title}. Posted on Hacker News Jobs${story.by ? ` by ${story.by}` : ""}.`,
    url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
    postedAt: story.time ? new Date(story.time * 1000) : null,
  };
}

export const hackerNewsJobsAdapter: JobSourceAdapter = {
  key: "hackernews-jobs",
  name: "Hacker News Jobs",
  baseUrl: "https://news.ycombinator.com/jobs",
  kind: "PUBLIC_API",

  async fetch() {
    const ids = await fetchJson<number[]>("Hacker News Jobs", `${API}/jobstories.json`);
    const stories = await mapWithLimit(ids.slice(0, MAX_STORIES), STORY_CONCURRENCY, (id) =>
      // One missing story shouldn't sink the list.
      fetchJson<HnStory | null>("Hacker News Jobs", `${API}/item/${id}.json`).catch(() => null),
    );
    return stories.flatMap((s) => {
      const posting = s ? normalizeHnStory(s) : null;
      return posting ? [posting] : [];
    });
  },
};
