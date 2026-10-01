"use client";

import { useEffect, useState } from "react";
import type { JobSummary } from "@/agents/jobSummary";

export function JobDescription({
  jobId,
  description,
  initialSummary,
}: {
  jobId: string;
  description: string;
  initialSummary: JobSummary | null;
}) {
  const [summary, setSummary] = useState<JobSummary | null>(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // First view of a posting generates its summary; every later view has it
  // cached on the row, so the page itself never waits on the LLM.
  useEffect(() => {
    if (summary) return;
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/summary`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not summarise this role.");
        if (!cancelled) setSummary(data.summary);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not summarise this role.");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, summary]);

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        {summary ? (
          <>
            <p className="text-sm font-medium">{summary.oneLiner}</p>
            <SummaryList title="What you'd do" items={summary.responsibilities} />
            <SummaryList title="Must-haves" items={summary.mustHaves} />
            <SummaryList title="Nice-to-haves" items={summary.niceToHaves} />
            {(summary.compensation || summary.locationAndRemote) && (
              <p className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
                {[summary.compensation, summary.locationAndRemote].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        ) : error ? (
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm" role="status" style={{ color: "var(--color-text-muted)" }}>
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              style={{ color: "var(--color-accent)" }}
              aria-hidden
            />
            Summarising this role...
          </div>
        )}
      </div>

      <button type="button" className="text-sm underline" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide full description" : "Read full description"}
      </button>
      {expanded && <div className="card whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{description}</div>}
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
