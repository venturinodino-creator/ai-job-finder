import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGamificationSummary } from "@/lib/gamification";
import { GamificationPanel } from "@/components/GamificationPanel";
import { SignalBar } from "@/components/SignalBar";
import { CompanySearch } from "@/components/CompanySearch";
import { IngestSourcesPanel } from "@/components/IngestSourcesPanel";
import { buildSourceStatus } from "@/lib/sourceStatus";
import { jobSourceAdapters } from "@/agents/sources";
import { listRecentSearches } from "@/lib/searchHistory";
import { RecentSearchesCard } from "@/components/RecentSearchesCard";

export default async function DashboardPage() {
  const userId = await requireDashboardUserId();

  const [profile, cv, latestDigest, gamification, sourceRows, recentSearches] = await Promise.all([
    db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    db.cv.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.dailyDigest.findFirst({ where: { userId }, orderBy: { digestDate: "desc" }, include: { entries: true } }),
    getGamificationSummary(userId),
    db.jobSource.findMany({
      select: { key: true, enabled: true, lastFetchedAt: true, lastError: true, _count: { select: { postings: true } } },
    }),
    listRecentSearches(userId, 6),
  ]);
  const latestReview = cv?.reviews[0] ?? null;
  const sources = buildSourceStatus(
    jobSourceAdapters,
    sourceRows.map((r) => ({ key: r.key, enabled: r.enabled, lastFetchedAt: r.lastFetchedAt, lastError: r.lastError, postings: r._count.postings })),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Daily briefing</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Overview</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
          <Card
            title="Search profile"
            body={profile ? profile.targetRoles.join(", ") || "No target roles set yet" : "Not set up yet"}
            href="/dashboard/profile"
            cta={profile ? "Edit" : "Set up"}
          />
          <div className="card flex flex-col gap-2">
            <h3 className="font-semibold text-sm">CV</h3>
            {cv && latestReview ? (
              <SignalBar value={latestReview.overallScore} tone="secondary" size="sm" />
            ) : (
              <p className="text-sm flex-1" style={{ color: "var(--color-text-muted)" }}>
                No CV uploaded yet
              </p>
            )}
            <Link href="/dashboard/cv" className="text-sm underline self-start mt-auto">
              {cv ? "View review" : "Upload"} →
            </Link>
          </div>
          <Card
            title="Latest digest"
            body={latestDigest ? `${latestDigest.entries.length} matches on ${latestDigest.digestDate.toDateString()}` : "None yet"}
            href="/dashboard/jobs"
            cta="View feed"
          />
        </div>

        <GamificationPanel {...gamification} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Submits to /dashboard/jobs, where the per-company results render. */}
          <CompanySearch query="" groups={null} />
        </div>
        <RecentSearchesCard searches={recentSearches} />
      </div>

      <IngestSourcesPanel sources={sources} />

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

function Card({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="card flex flex-col gap-2">
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-sm flex-1" style={{ color: "var(--color-text-muted)" }}>
        {body}
      </p>
      <Link href={href} className="text-sm underline self-start">
        {cta} →
      </Link>
    </div>
  );
}
