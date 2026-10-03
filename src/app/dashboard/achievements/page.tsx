import { requireDashboardUserId } from "@/lib/auth";
import { getGamificationSummary } from "@/lib/gamification";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";

export default async function AchievementsPage() {
  const userId = await requireDashboardUserId();
  const summary = await getGamificationSummary(userId);
  const unlockedCount = summary.achievements.filter((a) => a.unlocked).length;
  const toNext = Math.max(0, summary.pointsForNextLevel - summary.pointsIntoLevel);
  const levelPct = summary.pointsForNextLevel > 0 ? (summary.pointsIntoLevel / summary.pointsForNextLevel) * 100 : 0;

  return (
    <div className="space-y-8">
      <Reveal>
        <PageHero
          eyebrow="Field record"
          title="Achievements"
          description={`${toNext} ${toNext === 1 ? "point" : "points"} to level ${summary.level + 1}. Every step of the search earns points: scoring, opening, tailoring, applying.`}
          stats={[
            { label: "Unlocked", value: `${unlockedCount}/${summary.achievements.length}`, tone: "gamify" },
            { label: "Points", value: summary.points },
            { label: "Streak", value: summary.currentStreak, tone: "secondary", hint: `best ${summary.longestStreak} days` },
          ]}
          ring={{
            value: levelPct,
            label: `${summary.pointsIntoLevel} of ${summary.pointsForNextLevel} points to level ${summary.level + 1}`,
            caption: "Next level",
            text: `Lv ${summary.level}`,
          }}
        />
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.achievements.map((a, i) => (
          <Reveal key={a.key} index={i}>
            <div
              className="card flex h-full items-start gap-3"
              style={
                a.unlocked
                  ? {
                      background: "linear-gradient(135deg, var(--color-gamify-soft), var(--color-bg-elevated) 70%)",
                      borderColor: "color-mix(in srgb, var(--color-gamify) 35%, var(--color-border))",
                      boxShadow: "var(--shadow-card)",
                    }
                  : { opacity: 0.6 }
              }
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl"
                aria-hidden
                style={{
                  background: a.unlocked ? "var(--color-gamify-soft)" : "var(--color-bg)",
                  border: `1px solid ${a.unlocked ? "var(--color-gamify)" : "var(--color-border)"}`,
                  filter: a.unlocked ? undefined : "grayscale(1)",
                }}
              >
                {a.icon}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sm">{a.name}</p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {a.description}
                </p>
                <p className="font-data text-xs mt-1 font-medium" style={{ color: a.unlocked ? "var(--color-gamify)" : "var(--color-text-muted)" }}>
                  {a.unlocked ? `Unlocked ${new Date(a.unlockedAt!).toLocaleDateString()}` : `+${a.points} pts when unlocked`}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
