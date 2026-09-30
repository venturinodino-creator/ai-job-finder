"use client";

import { useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";
import type { PipelineCounts } from "@/lib/searchState";

const SEGMENTS = 12;

type Tone = "text" | "accent" | "secondary";
const TONE: Record<Tone, string> = {
  text: "var(--color-text)",
  accent: "var(--color-accent)",
  secondary: "var(--color-secondary)",
};

const STEPS: { key: keyof PipelineCounts; label: string; tone: Tone; hint: string }[] = [
  { key: "scored", label: "Scored", tone: "text", hint: "postings scored against your profile and CV" },
  { key: "strong", label: "Strong", tone: "secondary", hint: "scoring 60% or higher" },
  { key: "opened", label: "Opened", tone: "accent", hint: "postings you have read" },
  { key: "prepared", label: "Tailored or drafted", tone: "accent", hint: "a tailored CV or an application draft exists" },
  { key: "applied", label: "Applied", tone: "secondary", hint: "marked applied or sent by email" },
];

/**
 * The state of the current search as a funnel: five steps from scored to
 * applied, each with its count and a segmented bar showing what share of the
 * scored postings reached it. Drawn in the same signal language as every
 * other reading in the app. Steps are not links yet.
 */
export function Pipeline({ counts, caption, emptyHint }: { counts: PipelineCounts; caption?: string; emptyHint?: string }) {
  const reduceMotion = useReducedMotion();
  const total = counts.scored;

  return (
    <section className="card space-y-4" aria-label="Search pipeline" style={{ boxShadow: "var(--shadow-card)" }}>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
        {STEPS.map((step, i) => {
          const value = counts[step.key];
          const share = total === 0 ? 0 : value / total;
          const filled = value === 0 ? 0 : Math.max(1, Math.round(share * SEGMENTS));
          return (
            <li
              key={step.key}
              className="relative min-w-0"
              aria-label={`${step.label}: ${value}${i > 0 ? ` of ${total} scored` : ""}`}
              title={step.hint}
            >
              {i > 0 && (
                <span aria-hidden className="absolute -left-3 top-7 hidden text-xs md:block" style={{ color: "var(--color-border)" }}>
                  ›
                </span>
              )}
              <p className="eyebrow truncate">{step.label}</p>
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
