import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { RefreshMatchesButton } from "@/components/RefreshMatchesButton";
import { SignalBar } from "@/components/SignalBar";
import { CompanySearch, type CompanyPosting } from "@/components/CompanySearch";
import { groupPostingsByCompany, parseCompanyQuery } from "@/lib/companySearch";
import { listRecentSearches, recordSearch } from "@/lib/searchHistory";
import { RecentSearchesCard } from "@/components/RecentSearchesCard";

// Below this, a scored role isn't a "best match" — it's shown, but collapsed,
// so a thin run doesn't dress up 22% roles as the day's top picks.
const STRONG_MATCH_MIN = 60;

type SearchParams = Promise<{ companies?: string | string[] }>;

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireDashboardUserId();
  const profile = await db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });

  const { companies: rawCompanies } = await searchParams;
  const companyQuery = Array.isArray(rawCompanies) ? rawCompanies.join(", ") : (rawCompanies ?? "");
  const companyGroups = rawCompanies === undefined ? null : await searchCompanies(rawCompanies, profile?.id ?? null);
  if (companyGroups && companyGroups.length > 0) {
    const names = companyGroups.map((g) => g.name);
    await recordSearch(userId, "COMPANY_SEARCH", names.join(", "), { companies: names });
  }
  const recentSearches = await listRecentSearches(userId, 6);

  if (!profile) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="font-display text-3xl font-semibold">Job feed</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Set up a{" "}
            <Link href="/dashboard/profile" className="underline">
              search profile
            </Link>{" "}
            to get scored matches. You can still look up specific companies below.
          </p>
        </div>
        <CompanySearch query={companyQuery} groups={companyGroups} />
      <RecentSearchesCard searches={recentSearches} compact />
      </div>
    );
  }

  const matches = await db.matchScore.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isWildcard: "asc" }, { score: "desc" }],
    include: { jobPosting: { include: { source: true } } },
  });

  type Match = (typeof matches)[number];
  const main = matches.filter((m: Match) => !m.isWildcard);
  const strong = main.filter((m: Match) => m.score >= STRONG_MATCH_MIN);
  const other = main.filter((m: Match) => m.score < STRONG_MATCH_MIN);
  const wildcards = matches.filter((m: Match) => m.isWildcard);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Today&apos;s signal</p>
          <h1 className="font-display text-3xl font-semibold mt-1">Job feed</h1>
        </div>
        <RefreshMatchesButton />
      </div>

      <CompanySearch query={companyQuery} groups={companyGroups} />
      <RecentSearchesCard searches={recentSearches} compact />

      {matches.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No matches yet. Make sure you&apos;ve uploaded a CV and set it active on your search profile, then hit
          &quot;Refresh matches now&quot;.
        </p>
      )}

      {strong.length > 0 ? (
        <Section title="Best matches">
          {strong.map((m) => (
            <JobCard key={m.id} match={m} />
          ))}
        </Section>
      ) : (
        matches.length > 0 && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No strong matches ({STRONG_MATCH_MIN}%+) in this run — the roles below are the closest the sources had.
            Try &quot;Refresh matches now&quot; after the next ingest, or broaden your target roles.
          </p>
        )
      )}

      {wildcards.length > 0 && (
        <Section title="Wildcards 🎲">
          {wildcards.map((m) => (
            <JobCard key={m.id} match={m} />
          ))}
        </Section>
      )}

      {other.length > 0 && (
        <details className="group">
          <summary
            className="cursor-pointer font-display text-lg font-semibold list-none"
            style={{ color: "var(--color-text-muted)" }}
          >
            Other scored roles ({other.length}) <span className="text-sm font-normal">— show</span>
          </summary>
          <div className="space-y-3 pt-3">
            {other.map((m) => (
              <JobCard key={m.id} match={m} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Looks up every ingested posting from the requested companies (case-insensitive
 * substring on the company field) and decorates each with the user's match
 * score when their active profile has scored it. Returns one group per
 * requested company so the UI can say "nothing open" for the empty ones.
 */
async function searchCompanies(raw: string | string[], profileId: string | null) {
  const names = parseCompanyQuery(raw);
  if (names.length === 0) return [];

  const postings = await db.jobPosting.findMany({
    where: { OR: names.map((name) => ({ company: { contains: name, mode: "insensitive" as const } })) },
    orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { fetchedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      remoteType: true,
      postedAt: true,
      source: { select: { name: true } },
      matches: profileId
        ? { where: { profileId }, select: { score: true, isWildcard: true, appliedAt: true }, take: 1 }
        : false,
    },
  });

  const flat: CompanyPosting[] = postings.map((p) => ({
    id: p.id,
    title: p.title,
    company: p.company,
    location: p.location,
    remoteType: p.remoteType,
    postedAt: p.postedAt,
    source: p.source,
    match: "matches" in p && Array.isArray(p.matches) && p.matches[0] ? p.matches[0] : null,
  }));

  return groupPostingsByCompany(names, flat);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type MatchWithJob = Awaited<ReturnType<typeof db.matchScore.findMany>>[number] & {
  jobPosting: { title: string; company: string; location: string | null; remoteType: string; id: string; source: { name: string } };
};

function JobCard({ match }: { match: MatchWithJob }) {
  const job = match.jobPosting;
  const tone = match.isWildcard ? "gamify" : match.score >= 60 ? "secondary" : "accent";
  return (
    <Link
      href={`/dashboard/jobs/${job.id}`}
      className="card block transition-colors"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {job.title} <span style={{ color: "var(--color-text-muted)" }}>— {job.company}</span>
            </p>
            {match.appliedAt && (
              <span
                className="font-data text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5"
                style={{ background: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}
              >
                Applied
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {job.location ?? "Location n/a"} · {job.remoteType} · via {job.source.name}
          </p>
          <p className="text-sm mt-2">{match.explanation}</p>
          {match.wildcardReason && (
            <p className="text-sm mt-1" style={{ color: "var(--color-gamify)" }}>
              Why a wildcard: {match.wildcardReason}
            </p>
          )}
        </div>
        <SignalBar value={match.score} tone={tone} />
      </div>
    </Link>
  );
}
