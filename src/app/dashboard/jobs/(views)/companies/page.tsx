import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { CompanySearch, type CompanyPosting } from "@/components/CompanySearch";
import { groupPostingsByCompany, parseCompanyQuery } from "@/lib/companySearch";
import { listRecentSearches, recordSearch } from "@/lib/searchHistory";
import { RecentSearchesCard } from "@/components/RecentSearchesCard";

type SearchParams = Promise<{ companies?: string | string[] }>;

/**
 * Companies: look up every ingested posting from named employers, scored
 * against the active profile where a match exists. A search is recorded so
 * it can be re-run from the recent-searches card or the archive.
 */
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireDashboardUserId();
  const { companies: rawCompanies } = await searchParams;
  const profile = await db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });

  const query = Array.isArray(rawCompanies) ? rawCompanies.join(", ") : (rawCompanies ?? "");
  const groups = rawCompanies === undefined ? null : await searchCompanies(rawCompanies, profile?.id ?? null);
  if (groups && groups.length > 0) {
    const names = groups.map((g) => g.name);
    await recordSearch(userId, "COMPANY_SEARCH", names.join(", "), { companies: names });
  }
  const recentSearches = await listRecentSearches(userId, 6);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Companies</h1>
      <CompanySearch query={query} groups={groups} afterForm={<RecentSearchesCard searches={recentSearches} compact />} />
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
