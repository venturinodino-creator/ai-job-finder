import { SignalBar } from "./SignalBar";

interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export function GamificationPanel({
  points,
  level,
  pointsIntoLevel,
  pointsForNextLevel,
  currentStreak,
  longestStreak,
  achievements,
}: {
  points: number;
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  achievements: Achievement[];
}) {
  const recentUnlocked = achievements.filter((a) => a.unlocked).slice(-4).reverse();

  return (
    <div className="card space-y-4" style={{ borderColor: "var(--color-gamify-soft)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Your progress</p>
          <p className="font-display text-2xl font-semibold mt-0.5">Level {level}</p>
        </div>
        <div
          className="rounded-full px-3 py-1.5 font-data text-sm font-semibold"
          style={{ background: "var(--color-gamify-soft)", color: "var(--color-gamify)" }}
        >
          {points} pts
        </div>
      </div>

      <SignalBar value={pointsIntoLevel} max={pointsForNextLevel} tone="gamify" label={`${pointsIntoLevel} of ${pointsForNextLevel} points to next level`} />

      <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
        <span className="flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
          <span aria-hidden>🔥</span> {currentStreak}-day streak
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>Best: {longestStreak} days</span>
      </div>

      {recentUnlocked.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          {recentUnlocked.map((a) => (
            <span key={a.key} title={`${a.name} — ${a.description}`} className="text-xl" aria-hidden>
              {a.icon}
            </span>
          ))}
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            recent badges
          </span>
        </div>
      )}
    </div>
  );
}
