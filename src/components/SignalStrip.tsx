"use client";

import { useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";

export interface SignalReading {
  label: string;
  value: number;
  /** Optional unit rendered after the number, e.g. "%". */
  unit?: string;
  tone?: "text" | "secondary" | "gamify" | "accent";
}

const TONE: Record<NonNullable<SignalReading["tone"]>, string> = {
  text: "var(--color-text)",
  secondary: "var(--color-secondary)",
  gamify: "var(--color-gamify)",
  accent: "var(--color-accent)",
};

const BUCKET_ROWS = 6;

/**
 * The feed's instrument panel: the run's headline readings and how the scores
 * are distributed, drawn in the same segmented language as the signal bars so
 * the whole page reads as one instrument. Numbers count up on arrival.
 */
export function SignalStrip({
  readings,
  distribution,
  strongFrom,
  caption,
}: {
  readings: SignalReading[];
  /** Number of scored roles per 10-point bucket, index 0 = 0–9 … index 9 = 90–100. */
  distribution: number[];
  /** Bucket index from which a score counts as a strong match. */
  strongFrom: number;
  caption: string;
}) {
  const reduceMotion = useReducedMotion();
  const peak = Math.max(1, ...distribution);

  return (
    <section
      className="card grid gap-6 md:grid-cols-[1fr_auto] md:items-end"
      aria-label="Match run summary"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {readings.map((r) => (
          <div key={r.label} className="min-w-0">
            <p className="eyebrow truncate">{r.label}</p>
            <p className="font-data mt-1 text-2xl font-semibold leading-none tabular-nums" style={{ color: TONE[r.tone ?? "text"] }}>
              <CountUp value={r.value} instant={!!reduceMotion} />
              {r.unit && <span className="text-base font-medium">{r.unit}</span>}
            </p>
          </div>
        ))}
        <p className="col-span-2 text-xs sm:col-span-4" style={{ color: "var(--color-text-muted)" }}>
          {caption}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-1" role="img" aria-label={distributionLabel(distribution, strongFrom)}>
          {distribution.map((count, i) => {
            const filled = count === 0 ? 0 : Math.max(1, Math.round((count / peak) * BUCKET_ROWS));
            const strong = i >= strongFrom;
            return (
              <div key={i} className="flex flex-col-reverse gap-[2px]" title={`${i * 10}–${i === 9 ? 100 : i * 10 + 9}: ${count}`}>
                {Array.from({ length: BUCKET_ROWS }).map((_, row) => (
                  <span
                    key={row}
                    className={row < filled ? "signal-seg block h-1.5 w-2.5 rounded-[1px]" : "block h-1.5 w-2.5 rounded-[1px]"}
                    style={{
                      backgroundColor: row < filled ? (strong ? "var(--color-secondary)" : "var(--color-accent)") : "var(--color-border)",
                      animationDelay: `${150 + i * 30 + row * 30}ms`,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between font-data text-[10px] uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          <span>0</span>
          <span>score</span>
          <span>100</span>
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
