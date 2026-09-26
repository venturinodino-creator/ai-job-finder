"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TailorCvButton({ jobId, cvId }: { jobId: string; cvId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        className="btn-secondary"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const res = await fetch(`/api/jobs/${jobId}/tailor`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cvId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to tailor CV.");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to tailor CV.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Tailoring (calls the LLM)..." : "Tailor my CV to this job"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
