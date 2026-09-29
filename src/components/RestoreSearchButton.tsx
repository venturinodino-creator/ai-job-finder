"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Puts an archived search's criteria back on the active profile. The PATCH
 * archives the current search (with its results) and flags a re-score, so
 * this behaves exactly like editing the profile by hand.
 */
export function RestoreSearchButton({ profileId, snapshot }: { profileId: string; snapshot: Record<string, unknown> }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "saving" | "rescoring">("idle");
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setPhase("saving");
    setError(null);
    try {
      const { activeCvId: _ignored, ...criteria } = snapshot;
      void _ignored;
      const res = await fetch(`/api/profile/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to restore search.");
      if (data.rescore) {
        setPhase("rescoring");
        const run = await fetch("/api/digest/run", { method: "POST" });
        if (!run.ok) {
          const runData = await run.json().catch(() => ({}));
          throw new Error(`Criteria restored, but re-scoring failed: ${runData.error ?? run.statusText}.`);
        }
      }
      router.push("/dashboard/jobs");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore search.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button type="button" className="btn-secondary" disabled={phase !== "idle"} onClick={restore}>
        {phase === "saving" ? "Restoring..." : phase === "rescoring" ? "Re-scoring the feed (30-120s)..." : "Use these criteria again"}
      </button>
      {error && (
        <span className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
