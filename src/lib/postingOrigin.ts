import { PIPELINE_STAGE_LABELS, parseStage, stageHref, type PipelineStage } from "@/lib/pipelineStages";

// Where a posting was opened from, carried in the posting link's address so
// the posting page can offer a way back that survives a reload or a shared
// link. Pure: no database, no React.

export type PostingOrigin =
  | { view: "matches"; stage: PipelineStage | null }
  | { view: "companies"; companies: string }
  | { view: "archive" };

const POSTING_BASE = "/dashboard/jobs";

/** The address of a posting's page, carrying the view it is being opened from. */
export function postingHref(id: string, origin?: PostingOrigin): string {
  const base = `${POSTING_BASE}/${id}`;
  if (!origin) return base;
  const params = new URLSearchParams({ from: origin.view });
  if (origin.view === "matches" && origin.stage) params.set("stage", origin.stage);
  if (origin.view === "companies" && origin.companies) params.set("companies", origin.companies);
  return `${base}?${params}`;
}

/** The origin named by a posting page's query values; anything missing or unknown is unfiltered Matches. */
export function parseOrigin(query: { from?: unknown; stage?: unknown; companies?: unknown }): PostingOrigin {
  if (query.from === "archive") return { view: "archive" };
  if (query.from === "companies") return { view: "companies", companies: typeof query.companies === "string" ? query.companies : "" };
  return { view: "matches", stage: query.from === "matches" ? parseStage(query.stage) : null };
}

/** The way back to an origin: where it leads and what to call it. */
export function backLink(origin: PostingOrigin): { href: string; label: string } {
  if (origin.view === "archive") return { href: `${POSTING_BASE}/archive`, label: "Back to Archive" };
  if (origin.view === "companies") {
    const base = `${POSTING_BASE}/companies`;
    return origin.companies
      ? { href: `${base}?${new URLSearchParams({ companies: origin.companies })}`, label: `Back to Companies: ${origin.companies}` }
      : { href: base, label: "Back to Companies" };
  }
  const filtered = origin.stage !== null && origin.stage !== "scored";
  return {
    href: stageHref(POSTING_BASE, origin.stage ?? "scored"),
    label: filtered ? `Back to Matches: ${PIPELINE_STAGE_LABELS[origin.stage as PipelineStage]}` : "Back to Matches",
  };
}
