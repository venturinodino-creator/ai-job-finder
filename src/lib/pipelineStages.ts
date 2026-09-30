// The pipeline vocabulary on its own, with no database import, so client
// components (the Pipeline steps) can share it with the Search state module.

/** A scored role is a "strong match" from this score up; below it, it's shown but not led with. */
export const STRONG_MATCH_MIN = 60;

export interface PipelineCounts {
  /** Every match row of the current search, wildcards included. */
  scored: number;
  /** Non-wildcard rows at or above STRONG_MATCH_MIN. */
  strong: number;
  /** Rows whose posting the user has opened (or acted on further). */
  opened: number;
  /** Rows with a tailored CV or an application for the posting (or applied). */
  prepared: number;
  /** Rows marked applied, or with an application that was sent or applied. */
  applied: number;
}

/** A step of the pipeline; also the value the Matches view accepts as a filter. */
export type PipelineStage = keyof PipelineCounts;
export const PIPELINE_STAGES: readonly PipelineStage[] = ["scored", "strong", "opened", "prepared", "applied"];

/** How each stage is named wherever the product shows it. */
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  scored: "Scored",
  strong: "Strong",
  opened: "Opened",
  prepared: "Tailored or drafted",
  applied: "Applied",
};

/** The stage named by a query value, or null for anything that isn't one. */
export function parseStage(raw: unknown): PipelineStage | null {
  return typeof raw === "string" && (PIPELINE_STAGES as readonly string[]).includes(raw) ? (raw as PipelineStage) : null;
}

/** Where a pipeline step leads: the Matches view narrowed to that stage (the whole search for "scored"). */
export function stageHref(base: string, stage: PipelineStage): string {
  return stage === "scored" ? base : `${base}?stage=${stage}`;
}
