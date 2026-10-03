import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGamificationSummary } from "@/lib/gamification";
import { searchState } from "@/lib/searchState";
import { formatRelative } from "@/lib/formatRelative";
import { ProgressStrip } from "@/components/ProgressStrip";
import { AttentionFlags } from "@/components/AttentionFlags";
import { CvHealthCard } from "@/components/CvHealthCard";
import { SetupChecklist } from "@/components/SetupChecklist";
import { ScoringBanner } from "@/components/ScoringRun";
import { Pipeline } from "@/components/Pipeline";
import { OverviewHero } from "@/components/OverviewHero";
import { Reveal } from "@/components/Reveal";
import { IngestSourcesPanel } from "@/components/IngestSourcesPanel";
import { buildSourceStatus } from "@/lib/sourceStatus";
import { jobSourceAdapters } from "@/agents/sources";

export default async function DashboardPage() {
  const userId = await requireDashboardUserId();

  const [state, gamification, sourceRows] = await Promise.all([
    searchState(userId),
    getGamificationSummary(userId),
    db.jobSource.findMany({
      select: { key: true, enabled: true, lastFetchedAt: true, lastError: true, _count: { select: { postings: true } } },
    }),
  ]);
  const { profile, setup, scoring, pipeline, lastScoredAt, flags, activeCv, cvHealth } = state;
  const sources = buildSourceStatus(
    jobSourceAdapters,
    sourceRows.map((r) => ({ key: r.key, enabled: r.enabled, lastFetchedAt: r.lastFetchedAt, lastError: r.lastError, postings: r._count.postings })),
  );

  const scoredCaption = lastScoredAt ? `last scored ${formatRelative(lastScoredAt)}` : undefined;

  return (
    <div className="space-y-8">
      <Reveal>
        <OverviewHero pipeline={pipeline} roles={profile?.targetRoles ?? []} scoredCaption={scoredCaption} complete={setup.complete} />
      </Reveal>

      {/* Until the first matches exist, the checklist stands in for the numbers. */}
      {!setup.complete ? (
        <Reveal>
          <SetupChecklist setup={setup} scoringRunning={scoring.running} />
        </Reveal>
      ) : (
        <>
          {scoring.running && <ScoringBanner hasScores />}
          <Reveal index={1}>
            <Pipeline counts={pipeline} linkBase="/dashboard/jobs" />
          </Reveal>
        </>
      )}

      {setup.complete && (
        <Reveal index={2}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 min-w-0">
              <AttentionFlags flags={flags} />
            </div>
            <CvHealthCard cv={activeCv} health={cvHealth} />
          </div>
        </Reveal>
      )}

      <ProgressStrip summary={gamification} />

      <IngestSourcesPanel sources={sources} />

    </div>
  );
}
