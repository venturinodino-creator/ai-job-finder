"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeLink } from "@/components/UpgradeLink";
import { AllowanceRefusedError, errorFromResponse } from "@/lib/allowanceClient";

export function RefreshMatchesButton({ onHero = false }: { onHero?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeHref, setUpgradeHref] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        className={onHero ? "hero-cta" : "btn-secondary"}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          setUpgradeHref(null);
          try {
            const res = await fetch("/api/digest/run", { method: "POST" });
            if (!res.ok) {
              const data = await res.json();
              throw errorFromResponse(data, "Failed to refresh matches.");
            }
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to refresh matches.");
            if (err instanceof AllowanceRefusedError) setUpgradeHref(err.upgradeHref);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Scoring today's jobs against your profile — usually 1–3 minutes, keep this page open..." : "Refresh matches now"}
      </button>
      {error && (
        <span className="max-w-md text-sm" role="alert" style={{ color: onHero ? "#ffb4ab" : "var(--color-danger)" }}>
          {error}
        </span>
      )}
      {upgradeHref && <UpgradeLink href={upgradeHref} onHero={onHero} />}
    </div>
  );
}
