import Link from "next/link";
import { requireDashboardUserId } from "@/lib/auth";
import { touchDailyStreak, levelForPoints } from "@/lib/gamification";
import { db } from "@/lib/db";
import { LogoutButton } from "@/components/LogoutButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Search profile" },
  { href: "/dashboard/cv", label: "CV" },
  { href: "/dashboard/jobs", label: "Job feed" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/achievements", label: "Achievements" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireDashboardUserId();

  await touchDailyStreak(userId);
  const progress = await db.userProgress.findUnique({ where: { userId } });

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4 gap-6">
          <Link href="/dashboard" className="font-display text-lg font-semibold shrink-0">
            AI Job Finder
          </Link>
          <nav className="flex items-center gap-5 text-sm overflow-x-auto">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="whitespace-nowrap hover:opacity-70 transition-opacity">
                {link.label}
              </Link>
            ))}
          </nav>
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
