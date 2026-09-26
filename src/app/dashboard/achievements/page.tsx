import { requireDashboardUserId } from "@/lib/auth";
import { getGamificationSummary } from "@/lib/gamification";
import { SignalBar } from "@/components/SignalBar";

export default async function AchievementsPage() {
  const userId = await requireDashboardUserId();
  const summary = await getGamificationSummary(userId);
  const unlockedCount = summary.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Field record</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Achievements</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          {unlockedCount} of {summary.achievements.length} unlocked · Level {summary.level} · {summary.points} points
        </p>
      </div>

      <SignalBar
        value={summary.pointsIntoLevel}
        max={summary.pointsForNextLevel}
        tone="gamify"
        label={`${summary.pointsIntoLevel} of ${summary.pointsForNextLevel} points to level ${summary.level + 1}`}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.achievements.map((a) => (
          <div
            key={a.key}
            className="card flex items-start gap-3"
            style={{ opacity: a.unlocked ? 1 : 0.5 }}
          >
            <span className="text-2xl" aria-hidden>
              {a.icon}
            </span>
            <div>
              <p className="font-medium text-sm">{a.name}</p>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {a.description}
              </p>
              <p
                className="font-data text-xs mt-1 font-medium"
                style={{ color: a.unlocked ? "var(--color-gamify)" : "var(--color-text-muted)" }}
              >
                {a.unlocked
                  ? `Unlocked ${new Date(a.unlockedAt!).toLocaleDateString()}`
                  : `+${a.points} pts when unlocked`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
