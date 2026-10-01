import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardUserId } from "@/lib/auth";
import { markJobViewed } from "@/lib/jobs";
import { postingState } from "@/lib/searchState";
import { backLink, parseOrigin } from "@/lib/postingOrigin";
import { PostingReadingPanel } from "@/components/PostingReadingPanel";
import { PostingSteps } from "@/components/PostingSteps";
import { PostingTags } from "@/components/PostingCard";
import { postingSteps } from "@/lib/postingSteps";
import { formatRelative } from "@/lib/formatRelative";
import { TailorCvButton } from "@/components/TailorCvButton";
import { JobDescription } from "@/components/JobDescription";
import { ApplyPanel, type ApplicationView } from "@/components/ApplyPanel";
import { TailorChanges, type TailorSuggestion, type EditReport } from "@/components/TailorChanges";
import { isEmailConfigured } from "@/lib/email";
import { describeAttachment } from "@/lib/applications";
import type { JobSummary } from "@/agents/jobSummary";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type SearchParams = Promise<{ from?: string | string[]; stage?: string | string[]; companies?: string | string[] }>;

export default async function JobDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  // Where the posting was opened from; a missing or unknown origin leads back to Matches.
  const back = backLink(parseOrigin(await searchParams));
  const userId = await requireDashboardUserId();

  // Viewing counts before the reading is taken, so the posting reads as opened.
  await markJobViewed(userId, id);
  const state = await postingState(userId, id);
  if (!state) notFound();

  // Tailoring belongs to a specific CV: `tailored` is the active CV's only, so
  // after switching CVs the old one's suggestions are not shown as applicable.
  const { posting: job, activeCv, reading, application, tailored } = state;
  const applied = state.steps.applied;
  const applicationView: ApplicationView | null = application
    ? {
        id: application.id,
        status: application.status,
        method: application.method,
        subject: application.subject,
        coverNote: application.coverNote,
        sentTo: application.sentTo,
        sentAt: application.sentAt?.toISOString() ?? null,
        attachedFileName: application.attachedFileName,
      }
    : null;
  const attachmentLabel = describeAttachment(activeCv, tailored ? { editedStorageKey: tailored.editedStorageKey } : null);

  const steps = postingSteps({
    tailored: tailored !== null,
    draft: application?.status === "DRAFT",
    applied,
    appliedWithNote: Boolean(application?.coverNote),
  });
  const meta = [
    job.company,
    job.location ?? "Location n/a",
    job.remoteType.replace("_", " ").toLowerCase(),
    `via ${job.source.name}`,
    job.postedAt ? `posted ${formatRelative(job.postedAt)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={back.href} className="inline-block text-sm underline" style={{ color: "var(--color-text-muted)" }}>
          ← {back.label}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold">{job.title}</h1>
          <PostingTags
            reading={{ applied: applied !== null, isWildcard: reading?.isWildcard ?? false, locationMismatch: reading?.locationMismatch ?? false }}
          />
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {meta.join(" · ")}
        </p>
        <a href={job.url} target="_blank" rel="noreferrer" className="inline-block text-sm underline">
          View original posting
        </a>
      </header>

      {/* Desktop: the work on the left, the reading and the steps in a rail that stays in view.
          Phone: one column in the order reading, posting, steps. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:order-2 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto" aria-label="Match and steps">
          <PostingReadingPanel reading={reading} tailorHref="#tailor" />
          <PostingSteps steps={steps} className="hidden lg:block" />
        </aside>

        <div className="min-w-0 space-y-8 lg:order-1">
          <section id="posting" aria-labelledby="posting-heading" className="space-y-4 scroll-mt-24">
            <StepHeading id="posting-heading" number={1} title="The posting" />
            <JobDescription
              jobId={job.id}
              description={job.description}
              initialSummary={(job.summary as unknown as JobSummary | null) ?? null}
            />
          </section>

          {/* On a phone the steps come after the posting, just before the work they point to. */}
          <PostingSteps steps={steps} className="lg:hidden" />

          <section id="tailor" aria-labelledby="tailor-heading" className="space-y-4 scroll-mt-24">
            <StepHeading id="tailor-heading" number={2} title="Tailor your CV" note="Optional" />
            {!activeCv ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Upload and activate a CV first on the CV page.
              </p>
            ) : (
              <TailorCvButton jobId={job.id} cvId={activeCv.id} />
            )}

        {tailored && (
          <div className="space-y-3">
            {tailored.document ? (
              <div className="card space-y-3">
                <div>
                  <p className="text-sm font-medium">Proposed changes are ready to review</p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    Rephrased, reordered and re-emphasised from your uploaded CV only — nothing was invented, and
                    anything that couldn&apos;t be traced back to your CV was left out. Tick the changes you want below
                    and apply them to your own CV; its layout stays exactly as you made it.
                  </p>
                </div>
                <details>
                  <summary className="cursor-pointer text-xs underline" style={{ color: "var(--color-text-muted)" }}>
                    Plain-layout versions (not what gets attached)
                  </summary>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <a className="btn-secondary" href={`/api/jobs/${job.id}/tailored-cv?format=docx`}>
                      Generated layout (.docx)
                    </a>
                    <a className="btn-secondary" href={`/api/jobs/${job.id}/tailored-cv?format=txt`}>
                      Plain text (.txt)
                    </a>
                  </div>
                </details>
              </div>
            ) : (
              tailored.rewrittenText && (
                <div className="card">
                  <p className="text-sm font-medium mb-1">Suggested summary</p>
                  <p className="text-sm">{tailored.rewrittenText}</p>
                </div>
              )
            )}
            <TailorChanges
              jobId={job.id}
              suggestions={tailored.suggestions as unknown as TailorSuggestion[]}
              cvIsDocx={activeCv?.mimeType === DOCX_MIME}
              cvFileName={activeCv?.fileName ?? "your CV"}
              initialReport={(tailored.editReport as unknown as EditReport | null) ?? null}
            />
          </div>
        )}
          </section>

          <section id="apply" aria-labelledby="apply-heading" className="space-y-4 scroll-mt-24">
            <StepHeading id="apply-heading" number={3} title="Apply" />
            <ApplyPanel
              jobId={job.id}
              jobUrl={job.url}
              applyEmail={job.applyEmail}
              hasActiveCv={Boolean(activeCv)}
              attachmentLabel={attachmentLabel}
              emailEnabled={isEmailConfigured()}
              initial={applicationView}
              appliedInitially={applied ? { method: applied.method, at: applied.at.toISOString() } : null}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function StepHeading({ id, number, title, note }: { id: string; number: number; title: string; note?: string }) {
  return (
    <h2 id={id} className="font-display flex items-baseline gap-3 text-lg font-semibold">
      <span className="font-data text-sm" style={{ color: "var(--color-text-muted)" }} aria-hidden>
        {number}
      </span>
      {title}
      {note && (
        <span className="font-data text-xs font-normal uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          {note}
        </span>
      )}
    </h2>
  );
}
