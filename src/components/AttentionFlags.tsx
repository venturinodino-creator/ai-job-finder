import Link from "next/link";
import type { AttentionFlag } from "@/lib/searchState";

/**
 * What changed or is stuck since the user last looked: at most three items,
 * most important first, each with the one thing to do about it. An empty
 * list is good news and reads as such.
 */
export function AttentionFlags({ flags }: { flags: AttentionFlag[] }) {
  return (
    <section
      className="card space-y-3"
      aria-label="Needs attention"
      style={{
        borderLeft: `4px solid ${flags.length === 0 ? "var(--color-secondary)" : "var(--color-gamify)"}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: flags.length === 0 ? "var(--color-secondary)" : "var(--color-gamify)" }}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          </svg>
          Needs attention
        </p>
        {flags.length > 0 && (
          <p className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
            {flags.length === 1 ? "1 item" : `${flags.length} items`} · most important first
          </p>
        )}
      </div>

      {flags.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}>
            ✓
          </span>
          <div>
            <p className="font-medium">Nothing needs your attention</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Strong matches are opened, drafts are sent, your CV has no open high-severity issues and every source is healthy.
            </p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-[color:var(--color-border)]">
          {flags.map((flag, i) => (
            <li key={flag.kind} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="font-data mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: i === 0 ? "var(--color-accent)" : "var(--color-accent-soft)", color: i === 0 ? "var(--color-accent-fg)" : "var(--color-accent)" }}
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-snug">{flag.statement}</p>
              </div>
              <Link href={flag.action.href} className="btn-secondary shrink-0 text-sm" aria-label={`${flag.action.label}: ${flag.statement}`}>
                {flag.action.label} →
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
