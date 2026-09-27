"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TailorSuggestion {
  section: string;
  before: string;
  after: string;
  reason: string;
  kind?: "edit" | "note"; // older rows have no kind: treat as edit
}

export interface EditReport {
  applied: number[];
  notFound: number[];
  generatedAt: string;
}

/**
 * The review step: each proposed change with a checkbox, then "apply" writes
 * the ticked ones into the candidate's own .docx (their layout preserved) and
 * reports exactly which landed.
 */
export function TailorChanges({
  jobId,
  suggestions,
  cvIsDocx,
  cvFileName,
  initialReport,
}: {
  jobId: string;
  suggestions: TailorSuggestion[];
  cvIsDocx: boolean;
  cvFileName: string;
  initialReport: EditReport | null;
}) {
  const router = useRouter();
  const editIndexes = suggestions.map((s, i) => (s.kind === "note" ? -1 : i)).filter((i) => i >= 0);
  const notes = suggestions.filter((s) => s.kind === "note");
  const [accepted, setAccepted] = useState<Set<number>>(new Set(editIndexes));
  const [report, setReport] = useState<EditReport | null>(initialReport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const muted = { color: "var(--color-text-muted)" } as const;

  function toggle(i: number) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailored-cv/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: [...accepted].sort((a, b) => a - b) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not apply the changes.");
      setReport(data.report);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply the changes.");
    } finally {
      setBusy(false);
    }
  }

  const appliedSet = new Set(report?.applied ?? []);
  const notFoundSet = new Set(report?.notFound ?? []);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">Review the changes ({accepted.size} of {editIndexes.length} selected)</p>
        <button
          type="button"
          className="text-xs underline"
          style={muted}
          onClick={() => setAccepted(accepted.size === editIndexes.length ? new Set() : new Set(editIndexes))}
        >
          {accepted.size === editIndexes.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map((s, i) => s.kind === "note" ? null : (
          <label key={i} className="card text-sm flex gap-3 cursor-pointer" style={{ opacity: accepted.has(i) ? 1 : 0.55 }}>
            <input type="checkbox" className="mt-1" checked={accepted.has(i)} onChange={() => toggle(i)} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{s.section}</p>
                {appliedSet.has(i) && (
                  <span className="font-data text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5" style={{ background: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}>
                    applied
                  </span>
                )}
                {notFoundSet.has(i) && (
                  <span className="font-data text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
                    not found — apply by hand
                  </span>
                )}
              </div>
              <p className="line-through" style={muted}>
                {s.before}
              </p>
              <p>{s.after}</p>
              <p style={muted}>Why: {s.reason}</p>
            </div>
          </label>
        ))}
      </div>

      {notes.length > 0 && (
        <div className="card space-y-1">
          <p className="text-sm font-medium">What this posting wants that your CV doesn&apos;t show</p>
          <p className="text-xs" style={muted}>
            Nothing is added for these — it would be inventing experience. Worth knowing before you apply.
          </p>
          <ul className="text-sm list-disc pl-5 pt-1 space-y-0.5">
            {notes.map((n, i) => (
              <li key={i}>
                <span className="font-medium">{n.section.replace(/^gap note\s*[—-]\s*/i, "")}:</span> {n.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cvIsDocx ? (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={busy || accepted.size === 0} onClick={apply}>
              {busy ? "Applying to your CV..." : `Apply ${accepted.size} selected change${accepted.size === 1 ? "" : "s"} to my CV (keeps my layout)`}
            </button>
            {report && (
              <a className="btn-secondary" href={`/api/jobs/${jobId}/tailored-cv?format=original`}>
                Download my updated CV (.docx)
              </a>
            )}
          </div>
          {report && (
            <p className="text-xs" style={muted}>
              Applied {report.applied.length} change{report.applied.length === 1 ? "" : "s"} inside {cvFileName}, layout unchanged
              {report.notFound.length > 0
                ? `; ${report.notFound.length} couldn't be matched to a single paragraph and ${report.notFound.length === 1 ? "is" : "are"} marked above to apply by hand`
                : ""}
              . Generated {new Date(report.generatedAt).toLocaleString()}. This is the file your application attaches.
            </p>
          )}
          {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
        </div>
      ) : (
        <div className="card">
          <p className="text-sm">
            Your uploaded CV is a PDF, so these changes can&apos;t be applied inside it without breaking its layout. Upload the
            Word (.docx) version on the CV page, set it active, and tailor again — then the changes are written into your own
            document, formatting intact.
          </p>
        </div>
      )}
    </div>
  );
}
