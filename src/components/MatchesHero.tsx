"use client";

import { useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";

export interface SignalReading {
  label: string;
  value: number;
  tone?: "text" | "secondary" | "gamify" | "accent";
}

// Readings sit on the dark hero, so each tone has a lighter twin of the page colour.
const TONE: Record<NonNullable<SignalReading["tone"]>, string> = {
  text: "var(--hero-ink)",
  secondary: "var(--hero-signal)",
  gamify: "#f2c879",
  accent: "#a9c8ff",
};

const BUCKET_ROWS = 7;

/**
 * The top of Matches: what the last run found, as four readings and the shape
 * of the score distribution, on the same dark panel as the Overview. Numbers
 * count up on arrival. `action` is the refresh control, kept inside the panel
 * so the page has one obvious thing to do.
 */
export function MatchesHero({
  readings,
  distribution,
  strongFrom,
  caption,
  action,
}: {
  readings: SignalReading[];
  /** Number of scored roles per 10-point bucket, index 0 = 0–9 … index 9 = 90–100. */
  distribution: number[];
  /** Bucket index from which a score counts as a strong match. */
  strongFrom: number;
  caption: string;
  action: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const peak = Math.max(1, ...distribution);

  return (
    <section className="hero p-6 sm:p-8" aria-label="Match run summary">
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Latest run</p>
              <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">Matches</h1>
              {caption && (
                <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--hero-ink-muted)" }}>
                  {caption}
                </p>
              )}
            </div>
            {action}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {readings.map((r) => (
              <div key={r.label} className="hero-stat min-w-0">
                <dt className="eyebrow truncate">{r.label}</dt>
                <dd className="font-data mt-1.5 text-3xl font-semibold leading-none tabular-nums" style={{ color: TONE[r.tone ?? "text"] }}>
                  <CountUp value={r.value} instant={!!reduceMotion} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hero-stat flex flex-col gap-2">
          <p className="eyebrow">Score distribution</p>
          <div className="flex items-end gap-1.5" role="img" aria-label={distributionLabel(distribution, strongFrom)}>
            {distribution.map((count, i) => {
              const filled = count === 0 ? 0 : Math.max(1, Math.round((count / peak) * BUCKET_ROWS));
              const strong = i >= strongFrom;
              return (
                <div key={i} className="flex flex-col-reverse gap-[2px]" title={`${i * 10}–${i === 9 ? 100 : i * 10 + 9}: ${count}`}>
                  {Array.from({ length: BUCKET_ROWS }).map((_, row) => (
                    <span
                      key={row}
                      className={row < filled ? "signal-seg block h-2 w-3 rounded-[2px]" : "block h-2 w-3 rounded-[2px]"}
                      style={{
                        backgroundColor: row < filled ? (strong ? "var(--hero-signal)" : "rgba(255,255,255,0.6)") : "rgba(255,255,255,0.14)",
                        animationDelay: `${150 + i * 30 + row * 30}ms`,
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between font-data text-[10px] uppercase tracking-wide" style={{ color: "var(--hero-ink-muted)" }}>
            <span>0</span>
            <span style={{ color: "var(--hero-signal)" }}>{strongFrom * 10}%+ strong</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function distributionLabel(distribution: number[], strongFrom: number): string {
  const strong = distribution.slice(strongFrom).reduce((a, b) => a + b, 0);
  const total = distribution.reduce((a, b) => a + b, 0);
  return `Score distribution of the ${total} non-wildcard roles: ${strong} at ${strongFrom * 10}% or above`;
}
