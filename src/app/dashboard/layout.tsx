import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { touchDailyStreak, levelForPoints } from "@/lib/gamification";
import { db } from "@/lib/db";
import { LogoutButton } from "@/components/LogoutButton";
import { NavPills } from "@/components/NavPills";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Search profile" },
  { href: "/dashboard/cv", label: "CV" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/achievements", label: "Achievements" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireDashboardUserId();

  await touchDailyStreak(userId);
  const progress = await db.userProgress.findUnique({ where: { userId } });

  return (
    <div className="flex-1 flex flex-col">
      <header className="app-header border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between px-6 py-3 gap-x-6 gap-y-2">
          <Link href="/dashboard" className="font-display text-lg font-semibold shrink-0 flex items-center gap-2">
            <span aria-hidden className="inline-flex items-end gap-[2px]">
              {[3, 5, 8, 6].map((h, i) => (
                <span key={i} className="w-1 rounded-[1px]" style={{ height: `${h * 2}px`, background: i === 3 ? "var(--color-accent)" : "var(--color-secondary)" }} />
              ))}
            </span>
            AI Job Finder
          </Link>
          {/* Below md the nav drops to its own full-width row and scrolls sideways. */}
          <NavPills items={NAV_LINKS} className="max-md:order-last max-md:w-full" />
          <div className="flex items-center gap-4 shrink-0">
            {progress && (
              <Link
                href="/dashboard/achievements"
                className="font-data flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "var(--color-gamify-soft)", color: "var(--color-gamify)" }}
                title={`Level ${levelForPoints(progress.points)} · ${progress.points} pts`}
              >
                <span aria-hidden>🔥</span>
                {progress.currentStreak}
                <span className="opacity-60">· Lv{levelForPoints(progress.points)}</span>
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
