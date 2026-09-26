import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const userId = (await getCurrentUserId())!;

  const [profile, cv, latestDigest] = await Promise.all([
    db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
    db.cv.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { review: true } }),
    db.dailyDigest.findFirst({ where: { userId }, orderBy: { digestDate: "desc" }, include: { entries: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card
          title="Search profile"
          body={profile ? profile.targetRoles.join(", ") || "No target roles set yet" : "Not set up yet"}
          href="/dashboard/profile"
          cta={profile ? "Edit" : "Set up"}
        />
        <Card
          title="CV"
          body={cv ? `${cv.fileName} — score ${cv.review?.overallScore ?? "pending"}` : "No CV uploaded yet"}
          href="/dashboard/cv"
          cta={cv ? "View review" : "Upload"}
        />
        <Card
          title="Latest digest"
          body={latestDigest ? `${latestDigest.entries.length} matches on ${latestDigest.digestDate.toDateString()}` : "None yet"}
          href="/dashboard/jobs"
          cta="View feed"
        />
      </div>

      {!profile && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Start by <Link className="underline" href="/dashboard/profile">setting up your search profile</Link> and{" "}
          <Link className="underline" href="/dashboard/cv">uploading your CV</Link>. The first daily digest runs
          automatically once both are in place (or trigger one now from the job feed).
        </p>
      )}
    </div>
  );
}

function Card({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="card flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{body}</p>
      <Link href={href} className="text-sm underline self-start">
        {cta} →
      </Link>
    </div>
  );
}
