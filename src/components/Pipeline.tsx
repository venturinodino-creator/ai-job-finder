"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";
import { PIPELINE_STAGE_LABELS, stageHref, type PipelineCounts, type PipelineStage } from "@/lib/pipelineStages";

const SEGMENTS = 12;

type Tone = "text" | "accent" | "secondary";
const TONE: Record<Tone, string> = {
  text: "var(--color-text)",
  accent: "var(--color-accent)",
  secondary: "var(--color-secondary)",
};

const STEPS: { key: PipelineStage; tone: Tone; hint: string }[] = [
  { key: "scored", tone: "text", hint: "postings scored against your profile and CV" },
  { key: "strong", tone: "secondary", hint: "scoring 60% or higher" },
  { key: "opened", tone: "accent", hint: "postings you have read" },
  { key: "prepared", tone: "accent", hint: "a tailored CV or an application draft exists" },
  { key: "applied", tone: "secondary", hint: "marked applied or sent by email" },
];

/**
 * The state of the current search as a funnel: five steps from scored to
 * applied, each with its count and a segmented bar showing what share of the
 * scored postings reached it. Drawn in the same signal language as every
 * other reading in the app. With `linkBase`, each step opens that view
 * narrowed to its stage.
 */
export function Pipeline({
  counts,
  caption,
  emptyHint,
  linkBase,
}: {
  counts: PipelineCounts;
  caption?: string;
  emptyHint?: string;
  linkBase?: string;
}) {
  const reduceMotion = useReducedMotion();
  const total = counts.scored;

  return (
    <section className="card space-y-4" aria-label="Search pipeline" style={{ boxShadow: "var(--shadow-card)" }}>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
        {STEPS.map((step, i) => {
          const value = counts[step.key];
          const share = total === 0 ? 0 : value / total;
          const filled = value === 0 ? 0 : Math.max(1, Math.round(share * SEGMENTS));
          const label = PIPELINE_STAGE_LABELS[step.key];
          const accessible = `${label}: ${value}${i > 0 ? ` of ${total} scored` : ""}`;
          const body = (
            <>
              <p className="eyebrow truncate">{label}</p>
              <p className="font-data mt-1 text-3xl font-semibold leading-none tabular-nums" style={{ color: TONE[step.tone] }}>
                <CountUp value={value} instant={!!reduceMotion} />
              </p>
              <div className="mt-2 flex items-end gap-[2px]" aria-hidden>
                {Array.from({ length: SEGMENTS }).map((_, s) => (
                  <span
                    key={s}
                    className={s < filled ? "signal-seg block h-2 w-1.5 rounded-[1px]" : "block h-2 w-1.5 rounded-[1px]"}
                    style={{
                      backgroundColor: s < filled ? TONE[step.tone] : "var(--color-border)",
                      animationDelay: `${150 + i * 60 + s * 25}ms`,
                    }}
                  />
                ))}
              </div>
              {i > 0 && value > 0 && (
                <p className="font-data mt-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  {Math.round(share * 100)}% of scored
                </p>
              )}
            </>
          );
          return (
            <li key={step.key} className="relative min-w-0" title={step.hint}>
              {i > 0 && (
                <span aria-hidden className="absolute -left-3 top-7 hidden text-xs md:block" style={{ color: "var(--color-border)" }}>
                  ›
                </span>
              )}
              {linkBase ? (
                <Link href={stageHref(linkBase, step.key)} aria-label={`${accessible}. Open in Matches`} className="pipeline-step block rounded-md">
                  {body}
                </Link>
              ) : (
                <div role="group" aria-label={accessible}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {total === 0 && emptyHint && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {emptyHint}
        </p>
      )}
      {caption && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {caption}
        </p>
      )}
    </section>
  );
}
