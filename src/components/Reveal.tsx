"use client";

import { motion, useReducedMotion } from "motion/react";

// Entrance for list items and panels: a short rise-and-fade, staggered by
// index so a feed reads as arriving in order rather than popping in at once.
// The stagger is capped so long lists don't keep the reader waiting.
const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_STAGGER_STEPS = 8;

export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay: Math.min(index, MAX_STAGGER_STEPS) * 0.045 }}
    >
      {children}
    </motion.div>
  );
}
