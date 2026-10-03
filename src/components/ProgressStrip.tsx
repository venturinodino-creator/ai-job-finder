import Link from "next/link";
import { SignalBar } from "@/components/SignalBar";
import type { GamificationSummary } from "@/lib/gamification";

/**
 * Streak and progress to the next level as one quiet line, so they motivate
 * without competing with the search. The full achievements detail is one
 * click away.
 */
export function ProgressStrip({ summary }: { summary: GamificationSummary }) {
  const { level, points, pointsIntoLevel, pointsForNextLevel, currentStreak, longestStreak } = summary;
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg px-4 py-2.5 text-sm"
      style={{
        background: "linear-gradient(90deg, var(--color-gamify-soft), var(--color-bg-elevated) 55%)",
        border: "1px solid color-mix(in srgb, var(--color-gamify) 28%, var(--color-border))",
      }}
      aria-label="Your progress"
      role="group"
    >
      <span className="flex items-center gap-1.5 font-medium">
        <span aria-hidden>🔥</span>
        {currentStreak}-day streak
        <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>
          · best {longestStreak}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="font-data whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
          style={{ background: "var(--color-gamify)", color: "var(--color-bg-elevated)" }}
        >
          Level {level}
        </span>
        <SignalBar value={pointsIntoLevel} max={pointsForNextLevel} tone="gamify" size="sm" label={`${pointsIntoLevel} of ${pointsForNextLevel} points to level ${level + 1}`} />
        <span className="font-data whitespace-nowrap text-xs" style={{ color: "var(--color-text-muted)" }}>
          {points.toLocaleString()} pts
        </span>
      </span>
      <Link href="/dashboard/achievements" className="ml-auto whitespace-nowrap underline">
        Achievements →
      </Link>
    </div>
  );
}
