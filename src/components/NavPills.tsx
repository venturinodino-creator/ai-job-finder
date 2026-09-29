"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface NavPillItem {
  href: string;
  label: string;
}

/**
 * Primary navigation: the active section is a filled pill that slides between
 * links (KokonutUI's morphic-navbar pattern, restyled to the app's tokens and
 * driven by the real route rather than local state).
 */
export function NavPills({ items }: { items: NavPillItem[] }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label="Primary" className="flex items-center gap-0.5 overflow-x-auto rounded-lg p-1" style={{ background: "var(--color-bg)" }}>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              active ? "font-medium" : "hover:opacity-80",
            )}
            style={{ color: active ? "var(--color-accent-fg)" : "var(--color-text)", outlineColor: "var(--color-accent)" }}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-md"
                style={{ background: "var(--color-accent)" }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
              />
            )}
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
