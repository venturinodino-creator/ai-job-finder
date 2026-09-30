import Link from "next/link";

export interface RecentSearch {
  id: string;
  kind: "COMPANY_SEARCH" | "PROFILE_CHANGE";
  label: string;
  params: unknown;
  updatedAt: Date;
}

/**
 * The archive: the user's last searches, newest first. A company search
 * re-runs with one click; a profile snapshot links back to the profile page.
 */
export function RecentSearchesCard({ searches, compact = false }: { searches: RecentSearch[]; compact?: boolean }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-sm">{compact ? "Recent searches" : "Search archive"}</h3>
        <Link href="/dashboard/jobs/archive" className="text-xs underline" style={{ color: "var(--color-text-muted)" }}>
          Open archive →
        </Link>
      </div>

      {searches.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Nothing yet. Company searches, and each search profile you replace (with the matches it had), will show up
          here.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {searches.map((s) => (
            <li key={s.id} className="py-2 flex items-start gap-3 text-sm">
              <span
                className="font-data text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 mt-0.5 shrink-0"
                style={{
                  background: s.kind === "COMPANY_SEARCH" ? "var(--color-accent-soft, var(--color-bg))" : "var(--color-secondary-soft)",
                  color: s.kind === "COMPANY_SEARCH" ? "var(--color-accent)" : "var(--color-secondary)",
                }}
              >
                {s.kind === "COMPANY_SEARCH" ? "companies" : "profile"}
              </span>
              <div className="flex-1 min-w-0">
                <Link href={hrefFor(s)} className="hover:underline block truncate" title={s.label}>
                  {s.label}
                </Link>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {relativeTime(s.updatedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function hrefFor(s: RecentSearch): string {
  if (s.kind === "COMPANY_SEARCH") {
    const companies = (s.params as { companies?: string[] } | null)?.companies ?? [];
    return `/dashboard/jobs/companies?companies=${encodeURIComponent(companies.join(", "))}`;
  }
  return `/dashboard/jobs/archive#${s.id}`;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return date.toISOString().slice(0, 10);
}
