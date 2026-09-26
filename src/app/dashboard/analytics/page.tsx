import { requireDashboardUserId } from "@/lib/auth";
import { getAnalyticsSummary } from "@/lib/analytics";
import { CvScoreHistoryChart, ScoreDistributionChart, SourceBreakdownChart } from "@/components/AnalyticsCharts";

export default async function AnalyticsPage() {
  const userId = await requireDashboardUserId();
  const summary = await getAnalyticsSummary(userId);
  const { totalMatches, viewed, applied } = summary.jobsFunnel;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Your search, measured</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Analytics</h1>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatTile label="Total matches" value={totalMatches} />
        <StatTile label="Jobs viewed" value={viewed} sub={totalMatches > 0 ? `${Math.round((viewed / totalMatches) * 100)}%` : undefined} />
        <StatTile label="Jobs applied" value={applied} sub={totalMatches > 0 ? `${Math.round((applied / totalMatches) * 100)}%` : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display text-lg font-semibold mb-1">CV score over time</h2>
          <p className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>
            Every review you&apos;ve run, in order.
          </p>
          <CvScoreHistoryChart data={summary.cvScoreHistory} />
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold mb-1">Match score distribution</h2>
          <p className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>
            How your matches spread across the scoring range.
          </p>
          <ScoreDistributionChart data={summary.scoreDistribution} />
        </div>

        <div className="card lg:col-span-2">
          <h2 className="font-display text-lg font-semibold mb-1">Matches by source</h2>
          <p className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>
            Which job boards are surfacing your best-fit roles.
          </p>
          <SourceBreakdownChart data={summary.sourceBreakdown} />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="font-data text-3xl font-semibold">{value}</p>
        {sub && (
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
