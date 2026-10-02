// The one flow for saving a search, wherever it is saved from: save, then
// re-score with visible progress, then report done. A failed scoring run
// keeps the save and can be retried without saving again. The two calls it
// makes are passed in, so the flow itself has no network or React in it.

export type SavePhase = "idle" | "saving" | "scoring" | "score-failed";

export interface SaveSearchDeps {
  /**
   * Saves the search; resolves with whether it changed and so needs scoring,
   * and optionally where to land afterwards. Rejects with a message to show.
   */
  save(): Promise<{ rescore: boolean; land?: string }>;
  /** Runs the scoring run to completion. Rejects with a message to show. */
  score(): Promise<void>;
  /** Called on every phase change; `error` accompanies a failure. */
  onPhase(phase: SavePhase, error?: string): void;
  /** Called once the flow has finished; `rescored` says whether new scores exist, `land` where the save asked to go. */
  onDone(rescored: boolean, land?: string): void;
}

export async function runSaveSearch(deps: SaveSearchDeps): Promise<void> {
  deps.onPhase("saving");
  let rescore: boolean;
  let land: string | undefined;
  try {
    ({ rescore, land } = await deps.save());
  } catch (err) {
    deps.onPhase("idle", messageOf(err, "Could not save."));
    return;
  }
  if (!rescore) {
    deps.onPhase("idle");
    deps.onDone(false, land);
    return;
  }
  await retryScoring(deps, land);
}

/** The scoring half on its own: what a retry runs after a failed scoring run. */
export async function retryScoring(deps: Pick<SaveSearchDeps, "score" | "onPhase" | "onDone">, land?: string): Promise<void> {
  deps.onPhase("scoring");
  try {
    await deps.score();
  } catch (err) {
    deps.onPhase("score-failed", messageOf(err, "Scoring failed."));
    return;
  }
  deps.onPhase("idle");
  deps.onDone(true, land);
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
