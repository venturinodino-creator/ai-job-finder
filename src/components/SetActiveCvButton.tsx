"use client";

import { errorFromResponse } from "@/lib/allowanceClient";
import { SaveSearchStatus, useSaveSearch } from "@/components/ScoringRun";

/**
 * Attaches this CV to the search. A different CV is a different search, so
 * this goes through the same save-and-re-score flow as editing the profile:
 * visible progress, landing on Matches, a retry if scoring fails.
 */
export function SetActiveCvButton({ profileId, cvId }: { profileId: string; cvId: string }) {
  const flow = useSaveSearch();

  return (
    <div className="space-y-2">
      <button
        className="text-xs underline disabled:opacity-50"
        disabled={flow.busy || flow.phase === "score-failed"}
        onClick={() =>
          void flow.save(async () => {
            const res = await fetch(`/api/profile/${profileId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ activeCvId: cvId }),
            });
            const data = await res.json();
            if (!res.ok) throw errorFromResponse(data, "Could not use this CV for your search.");
            return { rescore: Boolean(data.rescore) };
          })
        }
      >
        {flow.phase === "saving" ? "Saving..." : "Use for search"}
      </button>
      <SaveSearchStatus flow={flow} savedNote="CV attached to your search." />
    </div>
  );
}
