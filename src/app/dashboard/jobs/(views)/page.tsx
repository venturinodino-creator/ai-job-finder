import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDashboardUserId } from "@/lib/auth";
import { RefreshMatchesButton } from "@/components/RefreshMatchesButton";
import { SignalStrip, type SignalReading } from "@/components/SignalStrip";
import { FeedTabs, type FeedTab } from "@/components/FeedTabs";
import { Reveal } from "@/components/Reveal";
import { PostingCard } from "@/components/PostingCard";
import { postingFromMatch } from "@/lib/posting";
import { PIPELINE_STAGE_LABELS, STRONG_MATCH_MIN, parseStage, searchState, type MatchWithJob } from "@/lib/searchState";
import { formatRelative } from "@/lib/formatRelative";

type SearchParams = Promise<{ companies?: string | string[]; stage?: string | string[] }>;

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireDashboardUserId();
  const { companies: rawCompanies, stage: rawStage } = await searchParams;
  // Company search moved to its own view; old links keep working.
  if (rawCompanies !== undefined) {
    const query = Array.isArray(rawCompanies) ? rawCompanies.join(", ") : rawCompanies;
    redirect(`/dashboard/jobs/companies?companies=${encodeURIComponent(query)}`);
  }
  // An unknown stage value is simply the unfiltered view.
  const stage = parseStage(rawStage);
  const state = await searchState(userId, { stage });
  const { profile } = state;

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-semibold">Matches</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Set up a{" "}
          <Link href="/dashboard/profile" className="underline">
            search profile
          </Link>{" "}
          to get scored matches. You can still{" "}
          <Link href="/dashboard/jobs/companies" className="underline">
            look up specific companies
          </Link>
          .
        </p>
      </div>
    );
  }

  const { strong, wildcards, other } = state.matches;
  const { pipeline, distribution, lastScoredAt: lastRun } = state;
  const hasMatches = pipeline.scored > 0;
  const shown = strong.length + wildcards.length + other.length;
  const stageLabel = stage ? PIPELINE_STAGE_LABELS[stage] : null;
  // Empty-group copy when a stage filter is on: the group is empty because of
  // the filter, not because the run found nothing.
  const filtered = (what: string) => (stageLabel ? `No ${what} among the ${stageLabel.toLowerCase()} roles.` : null);

  // The run summary always describes the whole search, whatever the stage filter.
  const wildcardCount = pipeline.scored - distribution.reduce((a, b) => a + b, 0);
  const readings: SignalReading[] = [
    { label: "Scored roles", value: pipeline.scored },
    { label: `Strong (${STRONG_MATCH_MIN}%+)`, value: pipeline.strong, tone: "secondary" },
    { label: "Wildcards", value: wildcardCount, tone: "gamify" },
    { label: "Applied", value: pipeline.applied, tone: "accent" },
  ];

  const tabs: FeedTab[] = [
    {
      id: "best",
      label: "Best matches",
      count: strong.length,
      note: `Roles scoring ${STRONG_MATCH_MIN}% or higher against your profile and CV.`,
      content: strong.length > 0 ? <CardList matches={strong} /> : <EmptyGroup>{filtered("strong matches") ?? <>No role reached {STRONG_MATCH_MIN}% in this run. The closest ones are under &quot;Other scored&quot;; refresh after the next ingest or broaden your target roles.</>}</EmptyGroup>,
    },
    {
      id: "wildcards",
      label: "Wildcards",
      count: wildcards.length,
      note: "Outside your exact targets, but a genuinely strong skills fit — worth a look.",
      content: wildcards.length > 0 ? <CardList matches={wildcards} /> : <EmptyGroup>{filtered("wildcards") ?? "No wildcards this run."}</EmptyGroup>,
    },
    {
      id: "other",
      label: "Other scored",
      count: other.length,
      note: `Everything else the run scored, below ${STRONG_MATCH_MIN}%.`,
      content: other.length > 0 ? <CardList matches={other} /> : <EmptyGroup>{filtered("other scored roles") ?? "Nothing else was scored in this run."}</EmptyGroup>,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Matches</h1>
        <RefreshMatchesButton />
      </div>

      {hasMatches ? (
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

      {hasMatches && stage && stageLabel && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          role="status"
          aria-label={`Showing ${stageLabel}: ${shown} of ${pipeline.scored} scored`}
          style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-border)" }}
        >
          <p>
            <span className="eyebrow">Showing</span>{" "}
            <span className="font-semibold">{stageLabel}</span>{" "}
            <span className="font-data" style={{ color: "var(--color-text-muted)" }}>
              {shown} of {pipeline.scored} scored
            </span>
          </p>
          <Link href="/dashboard/jobs" className="underline">
            Clear filter
          </Link>
        </div>
      )}

      {hasMatches && <FeedTabs tabs={tabs} key={stage ?? "all"} />}
    </div>
  );
}

function CardList({ matches }: { matches: MatchWithJob[] }) {
  return (
    <div className="space-y-3">
      {matches.map((m, i) => (
        <Reveal key={m.id} index={i}>
          <PostingCard posting={postingFromMatch(m)} />
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
