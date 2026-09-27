import Link from "next/link";
import type { CompanyGroup } from "@/lib/companySearch";
import { MAX_COMPANIES } from "@/lib/companySearch";
import { SignalBar } from "@/components/SignalBar";

export interface CompanyPosting {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remoteType: string;
  postedAt: Date | null;
  source: { name: string };
  /** The user's match score for this posting, when their active profile has scored it. */
  match: { score: number; isWildcard: boolean; appliedAt: Date | null } | null;
}

interface Props {
  /** The raw text the user typed, echoed back into the input. */
  query: string;
  /** One group per requested company, in the order typed. Null when no search is active. */
  groups: CompanyGroup<CompanyPosting>[] | null;
}

/**
 * Plain GET form so the search is bookmarkable and works without JS:
 * submitting lands on /dashboard/jobs?companies=OpenAI,Anthropic and the
 * page does the lookup server-side.
 */
export function CompanySearch({ query, groups }: Props) {
  return (
    <section className="space-y-4">
      <form action="/dashboard/jobs" method="get" className="card space-y-2">
        <label htmlFor="companies" className="block font-medium">
          Search specific companies
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="companies"
            name="companies"
            type="text"
            className="input"
            placeholder="e.g. OpenAI, Anthropic, Google DeepMind"
            defaultValue={query}
            maxLength={MAX_COMPANIES * 90}
            autoComplete="off"
          />
          <div className="flex gap-2 shrink-0">
            <button type="submit" className="btn-primary">
              Search
            </button>
            {groups && (
              <Link href="/dashboard/jobs" className="btn-secondary inline-flex items-center">
                Clear
              </Link>
            )}
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Comma-separated, up to {MAX_COMPANIES} companies. Looks through every posting our job sources have ingested,
          not just your scored matches.
        </p>
      </form>

      {groups && groups.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Type at least one company name to search.
        </p>
      )}

      {groups?.map((group) => (
        <CompanyGroupBlock key={group.name} group={group} />
      ))}
    </section>
  );
}

function CompanyGroupBlock({ group }: { group: CompanyGroup<CompanyPosting> }) {
  const count = group.postings.length;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-lg font-semibold">{group.name}</h2>
        <span className="font-data text-xs" style={{ color: "var(--color-text-muted)" }}>
          {count === 0 ? "no open roles" : count === 1 ? "1 open role" : `${count} open roles`}
        </span>
      </div>

      {count === 0 ? (
        <p
          className="card text-sm"
          style={{ color: "var(--color-text-muted)", borderStyle: "dashed" }}
        >
          No jobs available from {group.name} in our sources right now. Postings refresh with each ingest, so check
          back later.
        </p>
      ) : (
        <div className="space-y-3">
          {group.postings.map((job) => (
            <CompanyJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyJobCard({ job }: { job: CompanyPosting }) {
  const match = job.match;
  const tone = match?.isWildcard ? "gamify" : match && match.score >= 60 ? "secondary" : "accent";
  return (
    <Link href={`/dashboard/jobs/${job.id}`} className="card block transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {job.title} <span style={{ color: "var(--color-text-muted)" }}>— {job.company}</span>
            </p>
            {match?.appliedAt && (
              <span
                className="font-data text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5"
                style={{ background: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}
              >
                Applied
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {job.location ?? "Location n/a"} · {job.remoteType} · via {job.source.name}
            {job.postedAt && ` · posted ${job.postedAt.toISOString().slice(0, 10)}`}
          </p>
          {!match && (
            <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
              Not scored against your profile yet — open it to read the posting, or hit &quot;Refresh matches now&quot;.
            </p>
          )}
        </div>
        {match && <SignalBar value={match.score} tone={tone} />}
      </div>
    </Link>
  );
}
