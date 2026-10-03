import { summariseSources, type SourceHealth, type SourceStatus } from "@/lib/sourceStatus";
import { Disclosure } from "@/components/Disclosure";

const HEALTH_LABEL: Record<SourceHealth, string> = {
  ok: "OK",
  error: "Error",
  pending: "Not run yet",
  disabled: "Disabled",
};

const HEALTH_COLOR: Record<SourceHealth, string> = {
  ok: "var(--color-secondary)",
  error: "var(--color-danger)",
  pending: "var(--color-text-muted)",
  disabled: "var(--color-text-muted)",
};

/**
 * Every ingest agent (one per job source) as one line: how many sources,
 * how many postings they hold, and whether all are healthy. The line
 * expands to the per-source list: aggregator boards first, then the
 * per-company career pages, so the long tail doesn't bury the big feeds.
 */
export function IngestSourcesPanel({ sources }: { sources: SourceStatus[] }) {
  const boards = sources.filter((s) => s.kind !== "COMPANY_BOARD");
  const companies = sources.filter((s) => s.kind === "COMPANY_BOARD");
  const { postings, failing } = summariseSources(sources);
  const healthy = failing === 0;

  return (
    <Disclosure
      id="sources"
      className="card p-0 scroll-mt-24"
      summary={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm" aria-label={`Job sources: ${sources.length} sources, ${postings} postings, ${healthy ? "all healthy" : `${failing} failing`}`}>
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: healthy ? "var(--color-secondary)" : "var(--color-danger)" }} />
          <span className="font-medium">Job sources</span>
          <span className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
            {sources.length} sources · {postings.toLocaleString()} postings
          </span>
          <span className="font-data text-xs font-medium" style={{ color: healthy ? "var(--color-secondary)" : "var(--color-danger)" }}>
            {healthy ? "All healthy" : `${failing} failing`}
          </span>
          <span className="ml-auto text-xs underline [details[open]_&]:hidden" style={{ color: "var(--color-text-muted)" }}>
            Show sources
          </span>
          <span className="ml-auto hidden text-xs underline [details[open]_&]:inline" style={{ color: "var(--color-text-muted)" }}>
            Hide sources
          </span>
        </div>
      }
    >
      <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          The ingest agent runs every day at 05:00 UTC, pulls the sources below, and embeds new postings for
          matching. It starts with the sources that have waited longest, so a source marked &ldquo;Not run
          yet&rdquo; is picked up first in the next run. Company boards are read straight from the
          employer&apos;s own careers page.
        </p>
        <SourceGroup title="Job boards" sources={boards} />
        <SourceGroup title={`Company career pages (${companies.length})`} sources={companies} />
      </div>
    </Disclosure>
  );
}

function SourceGroup({ title, sources }: { title: string; sources: SourceStatus[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="card p-0 overflow-hidden">
      <h3 className="font-semibold text-sm px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        {title}
      </h3>
      <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {sources.map((s) => (
          <li key={s.key} className="px-4 py-2.5 flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ background: HEALTH_COLOR[s.health] }}
            />
            <div className="flex-1 min-w-0">
              <a href={s.baseUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                {s.name}
              </a>
              {s.health === "error" && s.lastError && (
                <p className="text-xs truncate" style={{ color: "var(--color-danger)" }} title={s.lastError}>
                  {s.lastError}
                </p>
              )}
            </div>
            <span className="font-data text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
              {s.postings.toLocaleString()} {s.postings === 1 ? "posting" : "postings"}
            </span>
            <span
              className="font-data text-[10px] uppercase tracking-wide whitespace-nowrap w-20 text-right"
              style={{ color: HEALTH_COLOR[s.health] }}
              title={s.lastFetchedAt ? `Last fetched ${s.lastFetchedAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : undefined}
            >
              {HEALTH_LABEL[s.health]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
