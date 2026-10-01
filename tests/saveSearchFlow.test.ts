import { describe, expect, it } from "vitest";
import { retryScoring, runSaveSearch, type SavePhase } from "../src/lib/saveSearchFlow";

// The one flow for saving a search: save, then re-score with visible
// progress, then report done; a failed scoring run keeps the save and can
// be retried without saving again. Tested with plain fakes for the two
// calls it makes, looking only at the phases it reports and what it calls.

function harness(opts: { save?: () => Promise<{ rescore: boolean }>; score?: () => Promise<void> } = {}) {
  const log: string[] = [];
  const phases: [SavePhase, string | undefined][] = [];
  const deps = {
    save: async () => {
      log.push("save");
      return opts.save ? opts.save() : { rescore: true };
    },
    score: async () => {
      log.push("score");
      if (opts.score) await opts.score();
    },
    onPhase: (phase: SavePhase, error?: string) => phases.push([phase, error]),
    onDone: (rescored: boolean) => log.push(`done:${rescored ? "rescored" : "saved"}`),
  };
  return { deps, log, phases };
}

describe("runSaveSearch", () => {
  it("saves, re-scores, then reports done", async () => {
    const { deps, log, phases } = harness();

    await runSaveSearch(deps);

    expect(log).toEqual(["save", "score", "done:rescored"]);
    expect(phases.map((p) => p[0])).toEqual(["saving", "scoring", "idle"]);
  });

  it("does not score when the save did not change the search", async () => {
    const { deps, log, phases } = harness({ save: async () => ({ rescore: false }) });

    await runSaveSearch(deps);

    expect(log).toEqual(["save", "done:saved"]);
    expect(phases.map((p) => p[0])).toEqual(["saving", "idle"]);
  });

  it("reports a failed save with its message and never scores", async () => {
    const { deps, log, phases } = harness({
      save: async () => {
        throw new Error("Add at least one target role.");
      },
    });

    await runSaveSearch(deps);

    expect(log).toEqual(["save"]);
    expect(phases).toEqual([
      ["saving", undefined],
      ["idle", "Add at least one target role."],
    ]);
  });

  it("keeps the save when scoring fails and says so", async () => {
    const { deps, log, phases } = harness({
      score: async () => {
        throw new Error("Scoring failed (HTTP 500).");
      },
    });

    await runSaveSearch(deps);

    expect(log).toEqual(["save", "score"]);
    expect(phases.at(-1)).toEqual(["score-failed", "Scoring failed (HTTP 500)."]);
  });
});

describe("retryScoring", () => {
  it("scores again without saving again, then reports done", async () => {
    let attempts = 0;
    const { deps, log, phases } = harness({
      score: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("Scoring failed.");
      },
    });
    await runSaveSearch(deps);

    await retryScoring(deps);

    expect(log).toEqual(["save", "score", "score", "done:rescored"]);
    expect(phases.map((p) => p[0])).toEqual(["saving", "scoring", "score-failed", "scoring", "idle"]);
  });

  it("stays failed when the retry fails too", async () => {
    const { deps, phases } = harness({
      score: async () => {
        throw new Error("Still failing.");
      },
    });

    await retryScoring(deps);

    expect(phases.at(-1)).toEqual(["score-failed", "Still failing."]);
  });
});
