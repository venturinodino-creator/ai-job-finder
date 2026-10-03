// Shared fetch for the adapters added with the source expansion: one
// User-Agent, one timeout, and an error that names the source, so a dead
// feed shows up on the Overview as "Name fetch failed: 404".

const USER_AGENT = "ai-job-finder (+https://github.com/venturinodino-creator/ai-job-finder)";
const REQUEST_TIMEOUT_MS = 20_000;

async function request(label: string, url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${label} fetch failed: ${res.status} ${res.statusText}`.trim());
  return res;
}

export async function fetchJson<T>(label: string, url: string): Promise<T> {
  const res = await request(label, url, "application/json");
  return (await res.json()) as T;
}

export async function fetchText(label: string, url: string): Promise<string> {
  const res = await request(label, url, "application/rss+xml, application/xml, text/xml, */*");
  return res.text();
}

/** Runs `task` over `items` with at most `limit` in flight, keeping result order. */
export async function mapWithLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Newest first; postings without a date sort last. */
export function newestFirst<T extends { postedAt: Date | null }>(postings: T[]): T[] {
  return [...postings].sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
}

/** `new Date(value)` that returns null instead of an Invalid Date. */
export function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
