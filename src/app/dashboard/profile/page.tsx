import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const userId = (await getCurrentUserId())!;
  const profile = await db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Search profile</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
        This is what the daily agents search for. Attach an uploaded CV on the{" "}
        <a href="/dashboard/cv" className="underline">
          CV page
        </a>{" "}
        to enable match scoring.
      </p>
      <ProfileForm profile={profile} />
    </div>
  );
}
