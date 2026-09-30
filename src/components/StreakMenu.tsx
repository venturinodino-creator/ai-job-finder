"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * The streak pill in the header: a button that opens a small menu with the
 * two things that used to sit beside it, Achievements and Log out. Opens on
 * click or Enter/Space, moves between items with the arrow keys, closes on
 * Escape (returning focus to the pill), Tab, or a click outside.
 */
export function StreakMenu({ streak, level, points }: { streak: number; level: number; points: number }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    // Focus the first item so the arrow keys work straight away.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const logOut = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${streak}-day streak, level ${level}. Open account menu`}
        title={`Level ${level} · ${points} pts`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="font-data flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--color-gamify-soft)", color: "var(--color-gamify)", outlineColor: "var(--color-accent)" }}
      >
        <span aria-hidden>🔥</span>
        {streak}
        <span className="opacity-60">· Lv{level}</span>
        <span aria-hidden className="opacity-60">
          ▾
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Account"
            onKeyDown={onMenuKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-40 mt-2 w-52 origin-top-right rounded-lg p-1 text-sm"
            style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card-hover)" }}
          >
            <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
              {streak}-day streak · Level {level} · {points.toLocaleString()} pts
            </p>
            <Link href="/dashboard/achievements" role="menuitem" className="menu-item" onClick={() => close(false)}>
              Achievements
            </Link>
            <button type="button" role="menuitem" className="menu-item w-full text-left" onClick={logOut} disabled={loggingOut}>
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
