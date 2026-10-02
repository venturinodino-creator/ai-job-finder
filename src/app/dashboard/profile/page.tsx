import { requireDashboardUserId } from "@/lib/auth";
import { searchState } from "@/lib/searchState";
import { ProfileForm } from "@/components/ProfileForm";
import { ProfileRail } from "@/components/ProfileRail";

export default async function ProfilePage() {
  const userId = await requireDashboardUserId();
  const { profile, activeCv, pipeline, lastScoredAt, scoring } = await searchState(userId);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Target parameters</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Search profile</h1>
        <p className="text-sm max-w-xl mt-2" style={{ color: "var(--color-text-muted)" }}>
          Everything else in the app is read against this search. Changing it replaces the search: the old one is kept in the Archive.
        </p>
      </div>

      {/* Phone: the summary first, then the sections. Desktop: sections left, summary in view on the right. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <aside className="lg:sticky lg:top-24 lg:order-2" aria-label="Summary of your search">
          <ProfileRail profile={profile} activeCv={activeCv} scored={pipeline.scored} lastScoredAt={lastScoredAt} scoringRunning={scoring.running} />
        </aside>
        <div className="min-w-0 lg:order-1">
          <ProfileForm profile={profile} scored={pipeline.scored} applied={pipeline.applied} />
        </div>
      </div>
    </div>
  );
}
