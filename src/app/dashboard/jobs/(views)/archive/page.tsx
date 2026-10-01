import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { listRecentSearches } from "@/lib/searchHistory";
import { parseArchivedResults } from "@/lib/archivedResults";
import { RestoreSearchButton } from "@/components/RestoreSearchButton";
import { PostingCard } from "@/components/PostingCard";
import { postingFromArchivedResult } from "@/lib/posting";

/**
 * The archive: every previous search, newest first. Profile searches keep
 * the matches the feed showed when they were replaced; company searches
 * re-run with one click.
 */
export default async function ArchivePage() {
  const userId = await requireDashboardUserId();
  const [entries, profile] = await Promise.all([
    listRecentSearches(userId, 50),
    db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const profileEntries = entries.filter((e) => e.kind === "PROFILE_CHANGE");
  const companyEntries = entries.filter((e) => e.kind === "COMPANY_SEARCH");

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">History</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Search archive</h1>
        <p className="text-sm max-w-2xl mt-2" style={{ color: "var(--color-text-muted)" }}>
          Every time you change your search profile, the search it replaces is filed here together with the
          matches the feed showed for it. Company lookups are kept too, so you can re-run them.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Previous search profiles ({profileEntries.length})</h2>
        {profileEntries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            None yet. Change your{" "}
            <Link href="/dashboard/profile" className="underline">
              search profile
            </Link>{" "}
            and the search you had before will appear here with its results.
          </p>
        ) : (
          profileEntries.map((entry) => {
            const results = parseArchivedResults(entry.results);
            const snapshot = (entry.params ?? {}) as Record<string, unknown>;
            return (
              <details key={entry.id} id={entry.id} className="card group" open={entry.id === profileEntries[0].id}>
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{entry.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Replaced {formatDate(entry.updatedAt)} · {entry.resultCount} {entry.resultCount === 1 ? "match" : "matches"}
                      {results.filter((r) => r.applied).length > 0 && ` · ${results.filter((r) => r.applied).length} applied`}
                    </p>
                  </div>
                  <span className="text-sm shrink-0" style={{ color: "var(--color-text-muted)" }}>
                    <span className="group-open:hidden">show</span>
                    <span className="hidden group-open:inline">hide</span>
                  </span>
                </summary>

                <div className="mt-4 space-y-4">
                  {profile && <RestoreSearchButton profileId={profile.id} snapshot={snapshot} />}
                  {results.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      No scored matches were on the feed when this search was replaced.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {results.map((r) => (
                        <PostingCard key={r.jobPostingId} posting={postingFromArchivedResult(r)} origin={{ view: "archive" }} />
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Company lookups ({companyEntries.length})</h2>
        {companyEntries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            None yet. Use the search box under{" "}
            <Link href="/dashboard/jobs/companies" className="underline">
              Companies
            </Link>
            .
          </p>
        ) : (
          <ul className="card divide-y p-0 overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
            {companyEntries.map((entry) => {
              const companies = ((entry.params as { companies?: string[] } | null)?.companies ?? []).join(", ");
              return (
                <li key={entry.id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{entry.label}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {formatDate(entry.updatedAt)}
                    </p>
                  </div>
                  <Link href={`/dashboard/jobs/companies?companies=${encodeURIComponent(companies)}`} className="btn-secondary whitespace-nowrap">
                    Run again
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
