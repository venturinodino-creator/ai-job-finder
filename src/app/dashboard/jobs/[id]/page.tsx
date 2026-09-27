import { notFound } from "next/navigation";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { markJobViewed } from "@/lib/jobs";
import { TailorCvButton } from "@/components/TailorCvButton";
import { MarkAppliedButton } from "@/components/MarkAppliedButton";
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

  const job = await db.jobPosting.findUnique({ where: { id }, include: { source: true } });
  if (!job) notFound();

  await markJobViewed(userId, id);

  const [activeProfile, matches, application] = await Promise.all([
    db.searchProfile.findFirst({ where: { userId, isActive: true }, include: { activeCv: true } }),
    db.matchScore.findMany({ where: { jobPostingId: id, profile: { userId } } }),
    db.application.findUnique({ where: { userId_jobPostingId: { userId, jobPostingId: id } } }),
  ]);
  const activeCv = activeProfile?.activeCv ?? null;
  // Tailoring belongs to a specific CV: after switching the active CV (e.g.
  // PDF -> .docx) the old CV's suggestions must not be shown as applicable.
  const tailored = activeCv
    ? await db.tailoredCv.findUnique({ where: { cvId_jobPostingId: { cvId: activeCv.id, jobPostingId: id } } })
    : null;
  const applied = matches.some((m) => m.appliedAt !== null);
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
        <div className="flex items-center gap-4">
          <a href={job.url} target="_blank" rel="noreferrer" className="text-sm underline">
            View original posting
          </a>
          <MarkAppliedButton jobId={job.id} appliedInitially={applied} />
        </div>
      </div>

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
        />
      </div>

      <div className="space-y-4">
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
