import { notFound } from "next/navigation";
import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { markJobViewed } from "@/lib/jobs";
import { TailorCvButton } from "@/components/TailorCvButton";
import { MarkAppliedButton } from "@/components/MarkAppliedButton";
import { JobDescription } from "@/components/JobDescription";
import type { JobSummary } from "@/agents/jobSummary";

interface TailorSuggestion {
  section: string;
  before: string;
  after: string;
  reason: string;
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireDashboardUserId();

  const job = await db.jobPosting.findUnique({ where: { id }, include: { source: true } });
  if (!job) notFound();

  await markJobViewed(userId, id);

  const [activeProfile, tailored, matches] = await Promise.all([
    db.searchProfile.findFirst({ where: { userId, isActive: true }, include: { activeCv: true } }),
    db.tailoredCv.findFirst({ where: { jobPostingId: id, cv: { userId } } }),
    db.matchScore.findMany({ where: { jobPostingId: id, profile: { userId } } }),
  ]);
  const activeCv = activeProfile?.activeCv ?? null;
  const applied = matches.some((m) => m.appliedAt !== null);

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
                  <p className="text-sm font-medium">Your tailored CV is ready to review</p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    Rephrased, reordered and re-emphasised from your uploaded CV only — nothing was invented, and
                    anything that couldn&apos;t be traced back to your CV was left out. Review it before you send it.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a className="btn-primary" href={`/api/jobs/${job.id}/tailored-cv?format=docx`}>
                    Download tailored CV (.docx)
                  </a>
                  <a className="btn-secondary" href={`/api/jobs/${job.id}/tailored-cv?format=txt`}>
                    Plain text (.txt)
                  </a>
                </div>
              </div>
            ) : (
              tailored.rewrittenText && (
                <div className="card">
                  <p className="text-sm font-medium mb-1">Suggested summary</p>
                  <p className="text-sm">{tailored.rewrittenText}</p>
                </div>
              )
            )}
            <p className="text-sm font-medium">What changed and why</p>
            <div className="space-y-2">
              {(tailored.suggestions as unknown as TailorSuggestion[]).map((s, i) => (
                <div key={i} className="card text-sm">
                  <p className="font-medium">{s.section}</p>
                  <p className="line-through" style={{ color: "var(--color-text-muted)" }}>
                    {s.before}
                  </p>
                  <p>{s.after}</p>
                  <p className="mt-1" style={{ color: "var(--color-text-muted)" }}>
                    Why: {s.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
