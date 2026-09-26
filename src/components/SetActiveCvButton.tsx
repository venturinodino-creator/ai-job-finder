"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SetActiveCvButton({ profileId, cvId }: { profileId: string; cvId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      className="text-xs underline disabled:opacity-50"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch(`/api/profile/${profileId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeCvId: cvId }),
        });
        router.refresh();
        setLoading(false);
      }}
    >
      Use for search
    </button>
  );
}
