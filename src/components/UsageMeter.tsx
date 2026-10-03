import { UpgradeLink } from "@/components/UpgradeLink";
import { UPGRADE_HREF, formatAllowanceTime, type AllowanceStatus } from "@/lib/entitlements";

const SEGMENTS = 12;

/**
 * One allowance as a reading: what the plan lets the user do, how much of it
 * is spent, and when the next unit opens. Drawn in the app's signal bar
 * language; once the allowance is spent it says so and offers the upgrade.
 */
export function UsageMeter({ status, label }: { status: AllowanceStatus; label: string }) {
  const spent = status.used >= status.limit;
  const filled = Math.min(SEGMENTS, Math.round((status.used / Math.max(1, status.limit)) * SEGMENTS));
  const tone = spent ? "var(--color-gamify)" : "var(--color-secondary)";

  return (
    <div
      className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3"
      role="group"
      aria-label={`${label} allowance`}
      style={{ borderLeft: `4px solid ${tone}` }}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="eyebrow">
          {label} · {status.plan === "FREE" ? "Free plan" : "Pro plan"}
        </p>
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex items-end gap-[2px]">
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <span key={i} className="block h-2.5 w-1.5 rounded-[1px]" style={{ background: i < filled ? tone : "var(--color-border)" }} />
            ))}
          </span>
          <span className="font-data text-sm font-medium tabular-nums">
            {status.used} of {status.limit} used {status.period}
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {spent && status.resetsAt ? `The next one opens ${formatAllowanceTime(status.resetsAt)}.` : "Resets automatically; nothing to do."}
        </p>
      </div>
      {spent && <UpgradeLink href={UPGRADE_HREF} />}
    </div>
  );
}
