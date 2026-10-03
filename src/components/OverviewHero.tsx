import Link from "next/link";
import { RingGauge } from "@/components/RingGauge";
import { stageHref, type PipelineCounts } from "@/lib/pipelineStages";

/**
 * The top of the Overview: the search in one sentence, the share of scored
 * postings that are strong matches as a ring, and the one thing to do next.
 * Before the first matches exist it welcomes the user instead.
 */
export function OverviewHero({
  pipeline,
  roles,
  scoredCaption,
  complete,
  greeting,
}: {
  pipeline: PipelineCounts;
  roles: string[];
  /** e.g. "Last scored 3 h ago"; omitted before the first run. */
  scoredCaption?: string;
  complete: boolean;
  /** e.g. "Good afternoon, Dino"; replaces the plain eyebrow. */
  greeting?: string;
}) {
  const { scored, strong } = pipeline;
  const share = scored === 0 ? 0 : Math.round((strong / scored) * 100);

  return (
    <section className="hero p-6 sm:p-8" aria-label="Search summary">
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="eyebrow">{greeting ?? (complete ? "Current search" : "Getting started")}</p>
            <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">
              {complete ? (
                <>
                  <span className="font-data" style={{ color: "var(--hero-signal)" }}>
                    {strong}
                  </span>{" "}
                  strong {strong === 1 ? "match" : "matches"} waiting
                </>
              ) : (
                "Overview"
              )}
            </h1>
            <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--hero-ink-muted)" }}>
              {complete
                ? `${scored} ${scored === 1 ? "posting" : "postings"} scored against your profile and CV${scoredCaption ? ` · ${scoredCaption}` : ""}.`
                : "Finish the steps below and your first matches will appear here."}
            </p>
          </div>

          {complete && roles.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Target roles">
              {roles.slice(0, 5).map((role) => (
                <li key={role} className="hero-chip">
                  {role}
                </li>
              ))}
              {roles.length > 5 && <li className="hero-chip">+{roles.length - 5} more</li>}
            </ul>
          )}

          {complete && (
            <div className="flex flex-wrap gap-3">
              <Link href={stageHref("/dashboard/jobs", "strong")} className="hero-cta">
                Review strong matches <span aria-hidden>→</span>
              </Link>
              <Link href="/dashboard/profile" className="hero-link">
                Adjust search
              </Link>
            </div>
          )}
        </div>

        {complete && scored > 0 && (
          <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
            <RingGauge
              value={share}
              size={112}
              stroke={10}
              color="var(--hero-signal)"
              track="rgba(255,255,255,0.16)"
              label={`${share}% of scored postings are strong matches`}
            >
              <span className="font-data text-3xl font-semibold leading-none">{share}%</span>
            </RingGauge>
            <p className="eyebrow text-center">Match quality</p>
          </div>
        )}
      </div>
    </section>
  );
}
