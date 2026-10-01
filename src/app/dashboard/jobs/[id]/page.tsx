import { notFound } from "next/navigation";
import { requireDashboardUserId } from "@/lib/auth";
import { markJobViewed } from "@/lib/jobs";
import { postingState } from "@/lib/searchState";
import { PostingReadingPanel } from "@/components/PostingReadingPanel";
import { TailorCvButton } from "@/components/TailorCvButton";
import { JobDescription } from "@/components/JobDescription";
import { ApplyPanel, type ApplicationView } from "@/components/ApplyPanel";
import { TailorChanges, type TailorSuggestion, type EditReport } from "@/components/TailorChanges";
import { isEmailConfigured } from "@/lib/email";
import { describeAttachment } from "@/lib/applications";
import type { JobSummary } from "@/agents/jobSummary";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{job.title}</h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          {job.company} · {job.location ?? "Location n/a"} · {job.remoteType} · via {job.source.name}
        </p>
        <a href={job.url} target="_blank" rel="noreferrer" className="text-sm underline">
          View original posting
        </a>
      </div>

      <PostingReadingPanel reading={reading} tailorHref="#tailor" />

      <JobDescription
        jobId={job.id}
        description={job.description}
        initialSummary={(job.summary as unknown as JobSummary | null) ?? null}
      />

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Apply for this role</h2>
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
      </div>

      <div id="tailor" className="space-y-4 scroll-mt-24">
        <h2 className="font-display text-lg font-semibold">Tailor your CV to this job</h2>
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
      </div>
    </div>
  );
}
