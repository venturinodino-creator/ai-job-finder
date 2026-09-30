import Link from "next/link";
import type { Cv } from "@/generated/prisma/client";
import type { CvHealth } from "@/lib/searchState";
import { SignalBar } from "@/components/SignalBar";
import { formatRelative } from "@/lib/formatRelative";

const VERDICT: Record<CvHealth["verdict"], { text: string; tone: "secondary" | "accent" }> = {
  STRONG: { text: "Strong", tone: "secondary" },
  GOOD: { text: "Good", tone: "secondary" },
  NEEDS_WORK: { text: "Needs work", tone: "accent" },
  WEAK: { text: "Weak", tone: "accent" },
};

/**
 * The health of the CV used for matching: its latest review score in the
 * signal bar, how that moved since the previous review, and how many
 * high-severity issues are still open. Without an active CV it invites an
 * upload rather than showing a zero.
 */
export function CvHealthCard({ cv, health }: { cv: Cv | null; health: CvHealth | null }) {
  return (
    <section className="card flex flex-col gap-3" aria-label="CV health">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">CV health</p>
        {cv && (
          <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }} title={cv.fileName}>
            {cv.fileName}
          </p>
        )}
      </div>

      {!cv ? (
        <>
          <p className="text-sm flex-1" style={{ color: "var(--color-text-muted)" }}>
            No CV is attached to your search yet. Upload one and set it active so postings are scored against it.
          </p>
          <Link href="/dashboard/cv" className="btn-primary self-start text-sm">
            Upload a CV →
          </Link>
        </>
      ) : !health ? (
        <>
          <p className="text-sm flex-1" style={{ color: "var(--color-text-muted)" }}>
            Not reviewed yet. The review scores the CV and lists what to fix.
          </p>
          <Link href="/dashboard/cv" className="btn-secondary self-start text-sm">
            Review CV →
          </Link>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <SignalBar value={health.score} tone={VERDICT[health.verdict].tone} label={`CV score ${health.score} of 100`} />
            <span
              className="font-data text-xs font-medium uppercase tracking-wide"
              style={{ color: `var(--color-${VERDICT[health.verdict].tone})` }}
            >
              {VERDICT[health.verdict].text}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="eyebrow">Since last review</dt>
              <dd className="font-data mt-1 tabular-nums" style={{ color: health.change === null ? "var(--color-text-muted)" : health.change >= 0 ? "var(--color-secondary)" : "var(--color-danger)" }}>
                {health.change === null ? "First review" : health.change > 0 ? `+${health.change}` : health.change === 0 ? "No change" : `${health.change}`}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">High-severity open</dt>
              <dd className="font-data mt-1 tabular-nums" style={{ color: health.highIssues > 0 ? "var(--color-danger)" : "var(--color-secondary)" }}>
                {health.highIssues}
              </dd>
            </div>
          </dl>
          <div className="mt-auto flex items-center justify-between gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span>Reviewed {formatRelative(health.reviewedAt)}</span>
            <Link href="/dashboard/cv" className="underline" style={{ color: "var(--color-text)" }}>
              Open review →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
