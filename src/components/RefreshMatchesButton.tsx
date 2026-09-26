"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshMatchesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-secondary"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const res = await fetch("/api/digest/run", { method: "POST" });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error ?? "Failed to refresh matches.");
            }
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to refresh matches.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Scoring today's jobs (this calls the LLM, can take ~30-60s)..." : "Refresh matches now"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
