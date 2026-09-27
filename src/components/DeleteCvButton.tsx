"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCvButton({ cvId, fileName }: { cvId: string; fileName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="text-xs underline disabled:opacity-50"
        style={{ color: "var(--color-danger)" }}
        disabled={loading}
        onClick={async () => {
          if (!confirm(`Delete "${fileName}" and its review? This can't be undone.`)) return;
          setLoading(true);
          setError(null);
          try {
            const res = await fetch(`/api/cv/${cvId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Delete failed.");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed.");
            setLoading(false);
          }
        }}
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</span>}
    </span>
  );
}
