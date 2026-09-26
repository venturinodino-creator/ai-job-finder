import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const userId = await requireDashboardUserId();
  const profile = await db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Target parameters</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Search profile</h1>
        <p className="text-sm max-w-xl mt-2" style={{ color: "var(--color-text-muted)" }}>
          This is what the daily agents search for. Attach an uploaded CV on the{" "}
          <a href="/dashboard/cv" className="underline">
            CV page
          </a>{" "}
          to enable match scoring.
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
