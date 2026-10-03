"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * A reading drawn as a ring that fills clockwise from the top. The centre
 * holds the number (children), so a ring is always a score or a share, never
 * decoration. Colours come from the caller so it works on the dark hero and
 * on a light card.
 */
export function RingGauge({
  value,
  size = 96,
  stroke = 9,
  color,
  track,
  label,
  children,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  label: string;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduceMotion ? circumference * (1 - pct) : circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
