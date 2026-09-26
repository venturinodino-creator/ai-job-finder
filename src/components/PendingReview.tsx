"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Parse + review normally finish within ~20s of upload. Past this, the
// upload almost certainly died midway (the CV row is written before the
// LLM steps run, and there's no transaction), so stop polling and offer
// a manual re-run instead of spinning forever.
const STALE_AFTER_MS = 2 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;

export function PendingReview({ cvId, createdAtMs }: { cvId: string; createdAtMs: number }) {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isStale = () => Date.now() - createdAtMs > STALE_AFTER_MS;
    if (isStale()) {
      setStale(true);
      return;
    }
    const timer = setInterval(() => {
      if (isStale()) {
        setStale(true);
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [createdAtMs, router]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/cv/${cvId}/review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setRetrying(false);
    }
  }

  if (!stale) {
    return (
      <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite" style={{ color: "var(--color-text-muted)" }}>
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--color-accent)" }}
          aria-hidden
        />
        Reviewing your CV (this calls the LLM, usually 10-20s)...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p style={{ color: "var(--color-text-muted)" }}>The review didn&apos;t complete.</p>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary" disabled={retrying} onClick={retry}>
          {retrying ? "Reviewing..." : "Run review"}
        </button>
        {error && <span style={{ color: "var(--color-danger)" }}>{error}</span>}
      </div>
    </div>
  );
}
