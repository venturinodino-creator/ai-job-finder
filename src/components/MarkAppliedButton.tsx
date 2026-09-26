"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAppliedButton({ jobId, appliedInitially }: { jobId: string; appliedInitially: boolean }) {
  const router = useRouter();
  const [applied, setApplied] = useState(appliedInitially);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        className={applied ? "btn-secondary" : "btn-primary"}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to update applied status.");
            setApplied(data.applied);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update applied status.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Saving..." : applied ? "✓ Applied — undo" : "Mark as applied"}
      </button>
      {error && <span className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}
