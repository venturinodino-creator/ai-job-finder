import Link from "next/link";
import type { Cv, SearchProfile } from "@/generated/prisma/client";
import { formatRelative } from "@/lib/formatRelative";
import { describeSnapshot, profileSnapshot } from "@/lib/profileSnapshot";

/**
 * The search as it stands, beside the form: the search in one line, when it
 * was last scored (or that it is being scored now), the CV it uses with a
 * link to change it, and the Archive of previous searches.
 */
export function ProfileRail({
  profile,
  activeCv,
  scored,
  lastScoredAt,
  scoringRunning,
}: {
  profile: SearchProfile | null;
  activeCv: Cv | null;
  scored: number;
  lastScoredAt: Date | null;
  scoringRunning: boolean;
}) {
  const muted = { color: "var(--color-text-muted)" } as const;
  return (
    <section className="card space-y-4" aria-label="Your search">
      <div>
        <p className="eyebrow">Your search</p>
        <p className="mt-1 text-sm font-medium leading-snug">{profile ? describeSnapshot(profileSnapshot(profile)) : "No search yet"}</p>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="eyebrow">Last scored</dt>
          <dd className="mt-1" style={muted}>
            {scoringRunning ? "Scoring now" : lastScoredAt ? `${formatRelative(lastScoredAt)} · ${scored} ${scored === 1 ? "match" : "matches"}` : "Not scored yet"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">CV used</dt>
          <dd className="mt-1">
            {activeCv ? (
              <>
                <span className="break-words">{activeCv.fileName}</span>
                <Link href="/dashboard/cv" className="mt-1 block text-xs underline" style={muted}>
                  Change on the CV page →
                </Link>
              </>
            ) : (
              <>
                <span style={muted}>None attached</span>
                <Link href="/dashboard/cv" className="mt-1 block text-xs underline" style={muted}>
                  Upload or choose a CV →
                </Link>
              </>
            )}
          </dd>
        </div>
      </dl>

      <Link href="/dashboard/jobs/archive" className="block text-sm underline" style={muted}>
        Previous searches in the Archive →
      </Link>
    </section>
  );
}
