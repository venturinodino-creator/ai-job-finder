import type { SourceHealth, SourceStatus } from "@/lib/sourceStatus";

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
 * Lists every ingest agent (one per job source) with what it has pulled in
 * and whether its last run succeeded. Aggregator boards first, then the
 * per-company career pages, so the long tail doesn't bury the big feeds.
 */
export function IngestSourcesPanel({ sources }: { sources: SourceStatus[] }) {
  const boards = sources.filter((s) => s.kind !== "COMPANY_BOARD");
  const companies = sources.filter((s) => s.kind === "COMPANY_BOARD");
  const total = sources.reduce((n, s) => n + s.postings, 0);
  const errors = sources.filter((s) => s.health === "error").length;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Ingest agents</p>
          <h2 className="font-display text-xl font-semibold mt-1">Where the jobs come from</h2>
        </div>
        <p className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
          {sources.length} sources · {total.toLocaleString()} postings
          {errors > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--color-danger)" }}>{errors} failing</span>
            </>
          )}
        </p>
      </div>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        The ingest agent runs every day at 05:00 UTC, pulls each source below, and embeds new postings for
        matching. Company boards are read straight from the employer&apos;s own careers page.
      </p>

      <SourceGroup title="Job boards" sources={boards} />
      <SourceGroup title={`Company career pages (${companies.length})`} sources={companies} />
    </section>
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
