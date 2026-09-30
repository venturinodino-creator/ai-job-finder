"use client";

import { useEffect, useState } from "react";

/**
 * A native details/summary that starts collapsed, and opens itself when the
 * page is reached at its own anchor (so a link to "#sources" lands on the
 * expanded list rather than a closed line).
 */
export function Disclosure({ id, summary, children, className }: { id: string; summary: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  return (
    <details id={id} className={className} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      {children}
    </details>
  );
}
