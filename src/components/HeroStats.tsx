"use client";

import { useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";

export interface HeroStat {
  label: string;
  /** A number counts up on arrival; a string (like "3/9") is shown as is. */
  value: number | string;
  tone?: "text" | "secondary" | "gamify" | "accent";
  /** Small line under the number, e.g. "89% of scored". */
  hint?: string;
}

// The stats sit on the dark hero, so each tone has a lighter twin of the page colour.
const TONE: Record<NonNullable<HeroStat["tone"]>, string> = {
  text: "var(--hero-ink)",
  secondary: "var(--hero-signal)",
  gamify: "#f2c879",
  accent: "#a9c8ff",
};

/** A row of glass tiles for the numbers that matter on a page. */
export function HeroStats({ stats }: { stats: HeroStat[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="hero-stat min-w-0">
          <dt className="eyebrow truncate">{s.label}</dt>
          <dd className="font-data mt-1.5 text-3xl font-semibold leading-none tabular-nums" style={{ color: TONE[s.tone ?? "text"] }}>
            {typeof s.value === "number" ? <CountUp value={s.value} instant={!!reduceMotion} /> : s.value}
          </dd>
          {s.hint && (
            <p className="font-data mt-1.5 text-[11px]" style={{ color: "var(--hero-ink-muted)" }}>
              {s.hint}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}
