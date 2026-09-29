"use client";

import { motion, useReducedMotion } from "motion/react";

const SEGMENTS = 12;

type Tone = "accent" | "secondary" | "gamify";

const TONE_VAR: Record<Tone, string> = {
  accent: "var(--color-accent)",
  secondary: "var(--color-secondary)",
  gamify: "var(--color-gamify)",
};

/**
 * The app's signature scoring device: every score (job match %, CV review
 * score, XP progress) renders as a row of filled segments plus a mono
 * numeral, so a reading always looks like a reading — not a decorated number.
 * Segments light up left to right on arrival, like a meter settling.
 */
export function SignalBar({
  value,
  max = 100,
  tone = "accent",
  label,
  size = "md",
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  size?: "sm" | "md";
}) {
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(pct * SEGMENTS);
  const height = size === "sm" ? "h-2.5" : "h-3";
  const width = size === "sm" ? "w-1" : "w-1.5";

  return (
    <div className="flex items-center gap-2" role="img" aria-label={label ?? `Score ${value} of ${max}`}>
      <div className="flex items-end gap-[2px]">
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const lit = i < filled;
          return (
            <motion.span
              key={i}
              className={`${width} ${height} rounded-[1px]`}
              style={{ backgroundColor: lit ? TONE_VAR[tone] : "var(--color-border)", originY: 1 }}
              initial={reduceMotion || !lit ? false : { opacity: 0.25, scaleY: 0.35 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.03, ease: "easeOut" }}
            />
          );
        })}
      </div>
      <span className="font-data text-sm font-medium tabular-nums" style={{ color: "var(--color-text)" }}>
        {Math.round(value)}
        {max === 100 ? "%" : `/${max}`}
      </span>
    </div>
  );
}
