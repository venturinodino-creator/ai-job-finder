import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { RefreshMatchesButton } from "@/components/RefreshMatchesButton";

export default async function JobsPage() {
  const userId = (await getCurrentUserId())!;
  const profile = await db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Job feed</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Set up a{" "}
          <Link href="/dashboard/profile" className="underline">
            search profile
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  const matches = await db.matchScore.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isWildcard: "asc" }, { score: "desc" }],
    include: { jobPosting: { include: { source: true } } },
  });

  type Match = (typeof matches)[number];
  const main = matches.filter((m: Match) => !m.isWildcard);
  const wildcards = matches.filter((m: Match) => m.isWildcard);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Job feed</h1>
        <RefreshMatchesButton />
      </div>

      {matches.length === 0 && (
        <p className="text-sm text-gray-500">
          No matches yet. Make sure you&apos;ve uploaded a CV and set it active on your search profile, then hit
          &quot;Refresh matches now&quot;.
        </p>
      )}

      {main.length > 0 && (
        <Section title="Best matches">
          {main.map((m) => (
            <JobCard key={m.id} match={m} />
          ))}
        </Section>
      )}

      {wildcards.length > 0 && (
        <Section title="Wildcards 🎲">
          {wildcards.map((m) => (
            <JobCard key={m.id} match={m} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type MatchWithJob = Awaited<ReturnType<typeof db.matchScore.findMany>>[number] & {
  jobPosting: { title: string; company: string; location: string | null; remoteType: string; id: string; source: { name: string } };
};

function JobCard({ match }: { match: MatchWithJob }) {
  const job = match.jobPosting;
  return (
    <Link href={`/dashboard/jobs/${job.id}`} className="card block hover:border-gray-400 dark:hover:border-gray-600">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {job.title} <span className="text-gray-500">— {job.company}</span>
          </p>
          <p className="text-xs text-gray-500">
            {job.location ?? "Location n/a"} · {job.remoteType} · via {job.source.name}
          </p>
          <p className="text-sm mt-1">{match.explanation}</p>
          {match.wildcardReason && <p className="text-sm text-purple-600 mt-1">Why a wildcard: {match.wildcardReason}</p>}
        </div>
        <span className="text-lg font-semibold whitespace-nowrap">{match.score}%</span>
      </div>
    </Link>
  );
}
