"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { retryScoring, runSaveSearch, type SavePhase } from "@/lib/saveSearchFlow";

/** What a scoring run usually takes, said the same way everywhere. */
export const SCORING_DURATION = "This usually takes 1–3 minutes; keep this page open.";

/** Starts the on-demand scoring run and resolves when it has finished; rejects with a message to show. */
export async function requestScoringRun(): Promise<void> {
  const res = await fetch("/api/digest/run", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Scoring failed (HTTP ${res.status}).`);
  }
}

/** The progress display for a scoring run in flight: the signal segments breathing, and how long it takes. */
export function ScoringProgress({ label = "Scoring today's postings against your profile and CV." }: { label?: string }) {
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {label} {SCORING_DURATION}
      </p>
      <div className="flex items-end gap-[2px]" role="progressbar" aria-label="Scoring in progress" aria-valuetext="In progress, usually 1 to 3 minutes">
        {Array.from({ length: 12 }).map((_, s) => (
          <span key={s} className="signal-seg setup-pulse block h-2 w-1.5 rounded-[1px]" style={{ backgroundColor: "var(--color-accent)", animationDelay: `${s * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The save-and-re-score flow as a hook: save, re-score with visible
 * progress, land on Matches. A failed scoring run keeps the save and
 * offers a retry that only scores. Shared by every place a search is saved.
 */
export function useSaveSearch(destination = "/dashboard/jobs") {
  const router = useRouter();
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const onPhase = useCallback((next: SavePhase, message?: string) => {
    setPhase(next);
    setError(message ?? null);
  }, []);
  const onDone = useCallback(
    (rescored: boolean) => {
      if (rescored) router.push(destination);
      router.refresh();
    },
    [router, destination],
  );

  const save = useCallback(
    (doSave: () => Promise<{ rescore: boolean }>) => runSaveSearch({ save: doSave, score: requestScoringRun, onPhase, onDone }),
    [onPhase, onDone],
  );
  const retry = useCallback(() => retryScoring({ score: requestScoringRun, onPhase, onDone }), [onPhase, onDone]);

  return { phase, error, busy: phase === "saving" || phase === "scoring", save, retry };
}

/** What the flow shows beneath a save control: progress while scoring, the error and a retry when scoring failed. */
export function SaveSearchStatus({ flow, savedNote }: { flow: ReturnType<typeof useSaveSearch>; savedNote: string }) {
  if (flow.phase === "scoring") {
    return (
      <div className="card space-y-2" aria-busy="true">
        <p className="text-sm font-medium">{savedNote}</p>
        <ScoringProgress label="Re-scoring today's postings for the new search." />
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          You&apos;ll be taken to your matches when they are ready.
        </p>
      </div>
    );
  }
  if (flow.phase === "score-failed") {
    return (
      <div className="card space-y-2" role="alert">
        <p className="text-sm font-medium">{savedNote}</p>
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          Re-scoring failed: {flow.error}
        </p>
        <button type="button" className="btn-primary text-sm" onClick={() => void flow.retry()}>
          Retry scoring
        </button>
      </div>
    );
  }
  if (flow.error) {
    return (
      <p className="text-sm" role="alert" style={{ color: "var(--color-danger)" }}>
        {flow.error}
      </p>
    );
  }
  return null;
}
