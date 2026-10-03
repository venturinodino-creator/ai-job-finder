"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";
import { PIPELINE_STAGE_LABELS, stageHref, type PipelineCounts, type PipelineStage } from "@/lib/pipelineStages";

const SEGMENTS = 12;

type Tone = "text" | "accent" | "secondary" | "gamify";
const TONE: Record<Tone, string> = {
  text: "var(--color-text)",
  accent: "var(--color-accent)",
  secondary: "var(--color-secondary)",
  gamify: "var(--color-gamify)",
};

// Each step has its own colour so the funnel reads left to right as it deepens:
// graphite for everything scored, green for strong, blue while you work on it,
// amber for prepared, green again for the finish.
const STEPS: { key: PipelineStage; tone: Tone; hint: string; icon: React.ReactNode }[] = [
  { key: "scored", tone: "text", hint: "postings scored against your profile and CV", icon: <path d="M4 19V9m6 10V5m6 14v-7m6 7H2" /> },
  { key: "strong", tone: "secondary", hint: "scoring 60% or higher", icon: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /> },
  { key: "opened", tone: "accent", hint: "postings you have read", icon: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></> },
  { key: "prepared", tone: "gamify", hint: "a tailored CV or an application draft exists", icon: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 13h6m-6 4h4" /> },
  { key: "applied", tone: "secondary", hint: "marked applied or sent by email", icon: <path d="m22 2-11 11M22 2l-7 20-4-9-9-4z" /> },
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
    <section className="space-y-3" aria-label="Search pipeline">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {STEPS.map((step, i) => {
          const value = counts[step.key];
          const share = total === 0 ? 0 : value / total;
          const filled = value === 0 ? 0 : Math.max(1, Math.round(share * SEGMENTS));
          const label = PIPELINE_STAGE_LABELS[step.key];
          const accessible = `${label}: ${value}${i > 0 ? ` of ${total} scored` : ""}`;
          const body = (
            <>
              <div className="relative flex min-h-10 items-start justify-between gap-2">
                <p className="eyebrow min-w-0 pt-1 leading-tight">{label}</p>
                <span className="stage-icon" aria-hidden>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {step.icon}
                  </svg>
                </span>
              </div>
              <p className="font-data relative mt-2 text-3xl font-semibold leading-none tabular-nums" style={{ color: TONE[step.tone] }}>
                <CountUp value={value} instant={!!reduceMotion} />
              </p>
              <div className="relative mt-3 flex items-end gap-[2px]" aria-hidden>
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
              <p className="font-data relative mt-1.5 h-4 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {i > 0 && value > 0 ? `${Math.round(share * 100)}% of scored` : ""}
              </p>
            </>
          );
          const tile = { "--tile-color": TONE[step.tone] } as React.CSSProperties;
          return (
            <li key={step.key} className="min-w-0" title={step.hint}>
              {linkBase ? (
                <Link href={stageHref(linkBase, step.key)} aria-label={`${accessible}. Open in Matches`} className="stage-tile block" style={tile}>
                  {body}
                </Link>
              ) : (
                <div role="group" aria-label={accessible} className="stage-tile" style={tile}>
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
