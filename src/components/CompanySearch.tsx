import Link from "next/link";
import type { CompanyGroup } from "@/lib/companySearch";
import { MAX_COMPANIES } from "@/lib/companySearch";
import { PostingCard } from "@/components/PostingCard";
import { postingFromCompanyPosting } from "@/lib/posting";

export interface CompanyPosting {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remoteType: string;
  postedAt: Date | null;
  source: { name: string };
  /** The user's match score for this posting, when their active profile has scored it. */
  match: { score: number; isWildcard: boolean; appliedAt: Date | null; locationMismatch?: boolean } | null;
}

interface Props {
  /** The raw text the user typed, echoed back into the input. */
  query: string;
  /** One group per requested company, in the order typed. Null when no search is active. */
  groups: CompanyGroup<CompanyPosting>[] | null;
  /** Rendered between the form and the results, e.g. the recent-searches archive. */
  afterForm?: React.ReactNode;
}

/**
 * Plain GET form so the search is bookmarkable and works without JS:
 * submitting lands on /dashboard/jobs/companies?companies=OpenAI,Anthropic
 * and the page does the lookup server-side.
 */
export function CompanySearch({ query, groups, afterForm }: Props) {
  return (
    <section className="space-y-4">
      <form action="/dashboard/jobs/companies" method="get" className="card space-y-2">
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
              <Link href="/dashboard/jobs/companies" className="btn-secondary inline-flex items-center">
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

      {afterForm}

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
            <PostingCard key={job.id} posting={postingFromCompanyPosting(job)} />
          ))}
        </div>
      )}
    </div>
  );
}
