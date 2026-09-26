import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold">
            AI Job Finder
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard/profile" className="hover:underline">
              Search profile
            </Link>
            <Link href="/dashboard/cv" className="hover:underline">
              CV
            </Link>
            <Link href="/dashboard/jobs" className="hover:underline">
              Job feed
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
