"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

/** Counts from 0 to `value` on mount; renders the value directly when `instant` (reduced motion). */
export function CountUp({ value, instant }: { value: number; instant: boolean }) {
  const mv = useMotionValue(instant ? value : 0);
  const rounded = useTransform(() => Math.round(mv.get()).toLocaleString());
  useEffect(() => {
    if (instant) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, instant, mv]);
  return <motion.span>{rounded}</motion.span>;
}
