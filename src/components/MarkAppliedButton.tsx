"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAppliedButton({ jobId, appliedInitially }: { jobId: string; appliedInitially: boolean }) {
  const router = useRouter();
  const [applied, setApplied] = useState(appliedInitially);
  const [loading, setLoading] = useState(false);

  return (
    <button
      className={applied ? "btn-secondary" : "btn-primary"}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
          const data = await res.json();
          setApplied(data.applied);
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Saving..." : applied ? "✓ Applied — undo" : "Mark as applied"}
    </button>
  );
}
