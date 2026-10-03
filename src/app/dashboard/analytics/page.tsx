import { requireDashboardUserId } from "@/lib/auth";
import { getAnalyticsSummary } from "@/lib/analytics";
import { CvScoreHistoryChart, ScoreDistributionChart, SourceBreakdownChart } from "@/components/AnalyticsCharts";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";

export default async function AnalyticsPage() {
  const userId = await requireDashboardUserId();
  const summary = await getAnalyticsSummary(userId);
  const { totalMatches, viewed, applied } = summary.jobsFunnel;
  const pct = (n: number) => (totalMatches > 0 ? Math.round((n / totalMatches) * 100) : 0);

  return (
    <div className="space-y-8">
      <Reveal>
        <PageHero
          eyebrow="Your search, measured"
          title="Analytics"
          description={
            totalMatches === 0
              ? "Once your first matches are scored, this page shows how you are working through them."
              : `You have read ${viewed} of ${totalMatches} matches and applied to ${applied}. The charts below show where the best roles come from.`
          }
          stats={[
            { label: "Total matches", value: totalMatches },
            { label: "Jobs viewed", value: viewed, tone: "accent", hint: totalMatches > 0 ? `${pct(viewed)}% of matches` : undefined },
            { label: "Jobs applied", value: applied, tone: "secondary", hint: totalMatches > 0 ? `${pct(applied)}% of matches` : undefined },
          ]}
          ring={totalMatches > 0 ? { value: pct(viewed), label: `${pct(viewed)}% of matches viewed`, caption: "Viewed" } : undefined}
        />
      </Reveal>

      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal index={1}>
          <ChartCard title="CV score over time" note="Every review you've run, in order.">
            <CvScoreHistoryChart data={summary.cvScoreHistory} />
          </ChartCard>
        </Reveal>

        <Reveal index={2}>
          <ChartCard title="Match score distribution" note="How your matches spread across the scoring range.">
            <ScoreDistributionChart data={summary.scoreDistribution} />
          </ChartCard>
        </Reveal>

        <Reveal index={3} className="lg:col-span-2">
          <ChartCard title="Matches by source" note="Which job boards are surfacing your best-fit roles.">
            <SourceBreakdownChart data={summary.sourceBreakdown} />
          </ChartCard>
        </Reveal>
      </div>
    </div>
  );
}

/** A chart panel with a coloured top edge, matching the stage tiles on the Overview. */
function ChartCard({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="card h-full" style={{ borderTop: "3px solid var(--color-accent)", boxShadow: "var(--shadow-card)" }}>
      <h2 className="font-display text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>
        {note}
      </p>
      {children}
    </div>
  );
}
