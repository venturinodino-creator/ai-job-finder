import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { RefreshMatchesButton } from "@/components/RefreshMatchesButton";
import { SignalBar } from "@/components/SignalBar";
import { SignalStrip, type SignalReading } from "@/components/SignalStrip";
import { FeedTabs, type FeedTab } from "@/components/FeedTabs";
import { Reveal } from "@/components/Reveal";
import { CompanySearch, type CompanyPosting } from "@/components/CompanySearch";
import { groupPostingsByCompany, parseCompanyQuery } from "@/lib/companySearch";
import { listRecentSearches, recordSearch } from "@/lib/searchHistory";
import { RecentSearchesCard } from "@/components/RecentSearchesCard";
import { LocationTag } from "@/components/LocationTag";

// Below this, a scored role isn't a "best match" — it's shown, but in its own
// tab, so a thin run doesn't dress up 22% roles as the day's top picks.
const STRONG_MATCH_MIN = 60;
const BUCKETS = 10;

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
          <p className="eyebrow">Today&apos;s signal</p>
          <h1 className="font-display text-3xl font-semibold">Job feed</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Set up a{" "}
            <Link href="/dashboard/profile" className="underline">
              search profile
            </Link>{" "}
            to get scored matches. You can still look up specific companies below.
          </p>
        </div>
        <CompanySearch query={companyQuery} groups={companyGroups} afterForm={<RecentSearchesCard searches={recentSearches} compact />} />
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
  const applied = matches.filter((m: Match) => m.appliedAt !== null).length;
  const lastRun = matches.reduce<Date | null>((latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest), null);

  const distribution = Array.from({ length: BUCKETS }, () => 0);
  for (const m of main) distribution[Math.min(BUCKETS - 1, Math.floor(m.score / 10))] += 1;

  const readings: SignalReading[] = [
    { label: "Scored roles", value: main.length },
    { label: `Strong (${STRONG_MATCH_MIN}%+)`, value: strong.length, tone: "secondary" },
    { label: "Wildcards", value: wildcards.length, tone: "gamify" },
    { label: "Applied", value: applied, tone: "accent" },
  ];

  const tabs: FeedTab[] = [
    {
      id: "best",
      label: "Best matches",
      count: strong.length,
      note: `Roles scoring ${STRONG_MATCH_MIN}% or higher against your profile and CV.`,
      content: strong.length > 0 ? <CardList matches={strong} /> : <EmptyGroup>No role reached {STRONG_MATCH_MIN}% in this run. The closest ones are under &quot;Other scored&quot;; refresh after the next ingest or broaden your target roles.</EmptyGroup>,
    },
    {
      id: "wildcards",
      label: "Wildcards",
      count: wildcards.length,
      note: "Outside your exact targets, but a genuinely strong skills fit — worth a look.",
      content: wildcards.length > 0 ? <CardList matches={wildcards} /> : <EmptyGroup>No wildcards this run.</EmptyGroup>,
    },
    {
      id: "other",
      label: "Other scored",
      count: other.length,
      note: `Everything else the run scored, below ${STRONG_MATCH_MIN}%.`,
      content: other.length > 0 ? <CardList matches={other} /> : <EmptyGroup>Nothing else was scored in this run.</EmptyGroup>,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Today&apos;s signal</p>
          <h1 className="font-display text-3xl font-semibold mt-1">Job feed</h1>
        </div>
        <RefreshMatchesButton />
      </div>

      {matches.length > 0 ? (
        <Reveal>
          <SignalStrip
            readings={readings}
            distribution={distribution}
            strongFrom={STRONG_MATCH_MIN / 10}
            caption={lastRun ? `Last scored ${formatRelative(lastRun)} · ${profile.targetRoles.join(", ") || "no target roles set"}` : ""}
          />
        </Reveal>
      ) : (
        <div className="card" style={{ borderStyle: "dashed" }}>
          <p className="font-medium">No matches yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Upload a CV and set it active on your search profile, then choose &quot;Refresh matches now&quot; to score today&apos;s postings.
          </p>
        </div>
      )}

      <CompanySearch query={companyQuery} groups={companyGroups} afterForm={<RecentSearchesCard searches={recentSearches} compact />} />

      {matches.length > 0 && <FeedTabs tabs={tabs} />}
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
      matches: profileId ? { where: { profileId }, select: { score: true, isWildcard: true, appliedAt: true, locationMismatch: true }, take: 1 } : false,
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

function formatRelative(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

type MatchWithJob = Awaited<ReturnType<typeof db.matchScore.findMany>>[number] & {
  jobPosting: { title: string; company: string; location: string | null; remoteType: string; id: string; source: { name: string } };
};

function CardList({ matches }: { matches: MatchWithJob[] }) {
  return (
    <div className="space-y-3">
      {matches.map((m, i) => (
        <Reveal key={m.id} index={i}>
          <JobCard match={m} />
        </Reveal>
      ))}
    </div>
  );
}

function EmptyGroup({ children }: { children: React.ReactNode }) {
  return (
    <p className="card text-sm" style={{ color: "var(--color-text-muted)", borderStyle: "dashed" }}>
      {children}
    </p>
  );
}

function JobCard({ match }: { match: MatchWithJob }) {
  const job = match.jobPosting;
  const tone = match.isWildcard ? "gamify" : match.score >= STRONG_MATCH_MIN ? "secondary" : "accent";
  return (
    <Link href={`/dashboard/jobs/${job.id}`} className="card card-link block">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
            {match.locationMismatch && <LocationTag />}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {job.location ?? "Location n/a"} · {job.remoteType.replace("_", " ").toLowerCase()} · via {job.source.name}
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
