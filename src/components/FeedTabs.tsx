"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface FeedTab {
  id: string;
  label: string;
  count: number;
  /** Colours the dot before the label: green for strong, amber for wildcards. */
  tone?: "secondary" | "gamify" | "accent";
  /** Short line under the tab list explaining what this group is. */
  note?: string;
  content: React.ReactNode;
}

/**
 * Segmented control over the feed's groups (best matches, wildcards, the
 * rest). The active pill slides between tabs with a shared layout animation
 * and the panel cross-fades, so switching groups feels like moving a dial
 * rather than swapping pages. Renders server-built card lists as children.
 */
export function FeedTabs({ tabs, defaultTab }: { tabs: FeedTab[]; defaultTab?: string }) {
  const reduceMotion = useReducedMotion();
  const first = tabs.find((t) => t.id === defaultTab) ?? tabs.find((t) => t.count > 0) ?? tabs[0];
  const [activeId, setActiveId] = useState(first?.id);
  const active = tabs.find((t) => t.id === activeId) ?? first;
  if (!active) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Match groups"
          className="inline-flex items-center gap-1 rounded-lg p-1"
          style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
        >
          {tabs.map((tab) => {
            const selected = tab.id === active.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`feed-panel-${tab.id}`}
                onClick={() => setActiveId(tab.id)}
                className="relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: selected ? "var(--color-text)" : "var(--color-text-muted)", outlineColor: "var(--color-accent)" }}
              >
                {selected && (
                  <motion.span
                    layoutId="feed-tab-pill"
                    className="absolute inset-0 rounded-md"
                    style={{ backgroundColor: "var(--color-bg-elevated)", boxShadow: "var(--shadow-card)" }}
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: tab.tone ? `var(--color-${tab.tone})` : "var(--color-border)", opacity: selected ? 1 : 0.6 }}
                  />
                  {tab.label}
                  <span
                    className="font-data rounded-full px-1.5 text-[11px] leading-5"
                    style={{
                      background: selected ? "var(--color-accent-soft)" : "transparent",
                      color: selected ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    {tab.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {active.note && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {active.note}
          </p>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active.id}
          id={`feed-panel-${active.id}`}
          role="tabpanel"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {active.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
