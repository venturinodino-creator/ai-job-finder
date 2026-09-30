import Link from "next/link";
import { SignalBar } from "@/components/SignalBar";
import { formatRelative } from "@/lib/formatRelative";
import { readingTone, type PostingSummary } from "@/lib/posting";

/**
 * The one card for a posting wherever postings are listed (Matches,
 * Companies, Archive): title and company, the Applied / Wildcard / Outside
 * your locations tags, where and when it was posted, the reading in the
 * signal bar, and the not-yet-scored state when the search hasn't met it.
 */
export function PostingCard({ posting }: { posting: PostingSummary }) {
  const { reading } = posting;
  const meta = [
    posting.location ?? "Location n/a",
    posting.remoteType ? posting.remoteType.replace("_", " ").toLowerCase() : null,
    `via ${posting.sourceName}`,
    posting.postedAt ? `posted ${formatRelative(posting.postedAt)}` : null,
  ].filter(Boolean);

  return (
    <Link href={`/dashboard/jobs/${posting.id}`} className="card card-link block">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {posting.title} <span style={{ color: "var(--color-text-muted)" }}>— {posting.company}</span>
            </p>
            {reading?.applied && <Tag tone="secondary">Applied</Tag>}
            {reading?.isWildcard && <Tag tone="gamify">Wildcard</Tag>}
            {reading?.locationMismatch && (
              <Tag tone="gamify" title="This posting is outside the locations on your search profile, so its score includes a location penalty.">
                Outside your locations
              </Tag>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {meta.join(" · ")}
          </p>
          {reading?.explanation && <p className="text-sm mt-2">{reading.explanation}</p>}
          {reading?.wildcardReason && (
            <p className="text-sm mt-1" style={{ color: "var(--color-gamify)" }}>
              Why a wildcard: {reading.wildcardReason}
            </p>
          )}
          {!reading && (
            <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
              Not scored against your profile yet — open it to read the posting, or choose &quot;Refresh matches now&quot; under Matches.
            </p>
          )}
        </div>
        {reading ? (
          <SignalBar value={reading.score} tone={readingTone(reading)} />
        ) : (
          <span
            className="font-data shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide"
            style={{ background: "var(--color-bg)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
            aria-label="Not scored yet"
          >
            Not scored
          </span>
        )}
      </div>
    </Link>
  );
}

function Tag({ tone, title, children }: { tone: "secondary" | "gamify"; title?: string; children: React.ReactNode }) {
  return (
    <span
      className="font-data text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5"
      style={{ background: `var(--color-${tone}-soft)`, color: `var(--color-${tone})` }}
      title={title}
    >
      {children}
    </span>
  );
}
