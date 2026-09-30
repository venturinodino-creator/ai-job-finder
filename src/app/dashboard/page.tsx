import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGamificationSummary } from "@/lib/gamification";
import { searchState } from "@/lib/searchState";
import { formatRelative } from "@/lib/formatRelative";
import { GamificationPanel } from "@/components/GamificationPanel";
import { Pipeline } from "@/components/Pipeline";
import { Reveal } from "@/components/Reveal";
import { CompanySearch } from "@/components/CompanySearch";
import { IngestSourcesPanel } from "@/components/IngestSourcesPanel";
import { buildSourceStatus } from "@/lib/sourceStatus";
import { jobSourceAdapters } from "@/agents/sources";
import { listRecentSearches } from "@/lib/searchHistory";
import { RecentSearchesCard } from "@/components/RecentSearchesCard";

export default async function DashboardPage() {
  const userId = await requireDashboardUserId();

  const [state, gamification, sourceRows, recentSearches] = await Promise.all([
    searchState(userId),
    getGamificationSummary(userId),
    db.jobSource.findMany({
      select: { key: true, enabled: true, lastFetchedAt: true, lastError: true, _count: { select: { postings: true } } },
    }),
    listRecentSearches(userId, 6),
  ]);
  const { profile, pipeline, lastScoredAt } = state;
  const sources = buildSourceStatus(
    jobSourceAdapters,
    sourceRows.map((r) => ({ key: r.key, enabled: r.enabled, lastFetchedAt: r.lastFetchedAt, lastError: r.lastError, postings: r._count.postings })),
  );

  const caption = profile
    ? lastScoredAt
      ? `Last scored ${formatRelative(lastScoredAt)} · ${profile.targetRoles.join(", ") || "no target roles set"}`
      : profile.targetRoles.join(", ") || "No target roles set yet"
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">{profile ? "Current search" : "Daily briefing"}</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Overview</h1>
      </div>

      <Reveal>
        <Pipeline
          counts={pipeline}
          caption={caption}
          emptyHint={
            profile
              ? "Nothing scored yet. Upload a CV, set it active on your search profile, then choose “Refresh matches now” on the Jobs page."
              : "Set up a search profile and upload a CV to start scoring postings."
          }
        />
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Submits to /dashboard/jobs, where the per-company results render. */}
          <CompanySearch query="" groups={null} />
        </div>
        <GamificationPanel {...gamification} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <IngestSourcesPanel sources={sources} />
        </div>
        <RecentSearchesCard searches={recentSearches} />
      </div>

      {!profile && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Start by <Link className="underline" href="/dashboard/profile">setting up your search profile</Link> and{" "}
          <Link className="underline" href="/dashboard/cv">uploading your CV</Link>. The first daily digest runs
          automatically once both are in place (or trigger one now from the job feed).
        </p>
      )}
    </div>
  );
}
