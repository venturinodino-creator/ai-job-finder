"use client";

import { SaveSearchStatus, useSaveSearch } from "@/components/ScoringRun";

/**
 * Puts an archived search's criteria back on the active profile. The save
 * archives the current search (with its results) and flags a re-score, so
 * this goes through the same save-and-re-score flow as editing the profile
 * by hand: visible progress, landing on Matches, a retry if scoring fails.
 */
export function RestoreSearchButton({ profileId, snapshot }: { profileId: string; snapshot: Record<string, unknown> }) {
  const flow = useSaveSearch();

  const restore = () =>
    flow.save(async () => {
      // The CV attached now stays; only the criteria come back.
      const { activeCvId: _ignored, ...criteria } = snapshot;
      void _ignored;
      const res = await fetch(`/api/profile/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to restore search.");
      return { rescore: Boolean(data.rescore) };
    });

  return (
    <div className="space-y-3">
      <button type="button" className="btn-secondary" disabled={flow.busy || flow.phase === "score-failed"} onClick={() => void restore()}>
        {flow.phase === "saving" ? "Restoring..." : "Use these criteria again"}
      </button>
      <SaveSearchStatus flow={flow} savedNote="Criteria restored." />
    </div>
  );
}
