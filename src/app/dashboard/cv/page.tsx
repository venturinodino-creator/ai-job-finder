import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { CvUploadForm } from "@/components/CvUploadForm";
import { PendingReview } from "@/components/PendingReview";
import { DeleteCvButton } from "@/components/DeleteCvButton";
import { SetActiveCvButton } from "@/components/SetActiveCvButton";
import { SignalBar } from "@/components/SignalBar";
import { ScoringBanner } from "@/components/ScoringRun";
import { isScoringRunning } from "@/lib/scoringRun";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";

const VERDICT_LABEL: Record<string, { text: string; tone: "secondary" | "accent" }> = {
  STRONG: { text: "Strong", tone: "secondary" },
  GOOD: { text: "Good", tone: "secondary" },
  NEEDS_WORK: { text: "Needs work", tone: "accent" },
  WEAK: { text: "Weak", tone: "accent" },
};

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "var(--color-danger)",
  MEDIUM: "var(--color-gamify)",
  LOW: "var(--color-accent)",
};

export default async function CvPage() {
  const userId = await requireDashboardUserId();
  const [cvs, profile] = await Promise.all([
    db.cv.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 1, include: { issues: true } } },
    }),
    db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);
  type CvWithReview = (typeof cvs)[number];
  type Issue = CvWithReview["reviews"][number]["issues"][number];

  // The hero reads the CV the search uses, falling back to the newest one.
  const headlineCv = cvs.find((c: CvWithReview) => c.id === profile?.activeCvId) ?? cvs[0] ?? null;
  const headlineReview = headlineCv?.reviews[0] ?? null;
  const headlineVerdict = headlineReview ? VERDICT_LABEL[headlineReview.verdict] : null;
  const highIssues = headlineReview ? headlineReview.issues.filter((i: Issue) => i.severity === "HIGH").length : 0;

  return (
    <div className="space-y-8">
      <Reveal>
        <PageHero
          eyebrow="CV intelligence"
          title="Your CV"
          description="PDF, DOCX or plain text, up to 10MB. We rate it and give concrete fixes right after upload."
          stats={
            headlineReview
              ? [
                  { label: "CVs uploaded", value: cvs.length },
                  { label: "Fixes suggested", value: headlineReview.issues.length, tone: "accent" },
                  { label: "High severity", value: highIssues, tone: highIssues > 0 ? "gamify" : "secondary" },
                ]
              : undefined
          }
          ring={
            headlineReview
              ? { value: headlineReview.overallScore, label: `CV score ${headlineReview.overallScore} of 100`, caption: headlineVerdict?.text ?? "Score", text: String(Math.round(headlineReview.overallScore)) }
              : undefined
          }
        >
          <CvUploadForm />
        </PageHero>
      </Reveal>

      {/* Attaching a CV re-scores the search; say so from the server's state, so the page still shows it after a refresh. */}
      {isScoringRunning(profile?.scoringStartedAt ?? null) && <ScoringBanner hasScores={false} />}

      <div className="space-y-4">
        {cvs.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No CVs uploaded yet.
          </p>
        )}
        {cvs.map((cv: CvWithReview) => {
          const review = cv.reviews[0] ?? null;
          const verdict = review ? VERDICT_LABEL[review.verdict] : null;
          return (
            <div key={cv.id} className="card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{cv.fileName}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Uploaded {cv.createdAt.toDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {profile?.activeCvId === cv.id ? (
                    <span
                      className="font-data text-xs font-medium rounded-full px-2.5 py-1"
                      style={{ background: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}
                    >
                      Active for search
                    </span>
                  ) : profile ? (
                    <SetActiveCvButton profileId={profile.id} cvId={cv.id} />
                  ) : null}
                  <DeleteCvButton cvId={cv.id} fileName={cv.fileName} />
                </div>
              </div>

              {review ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <SignalBar value={review.overallScore} tone={verdict?.tone} />
                    {verdict && (
                      <span
                        className="font-data text-xs font-medium uppercase tracking-wide"
                        style={{ color: verdict.tone === "secondary" ? "var(--color-secondary)" : "var(--color-accent)" }}
                      >
                        {verdict.text}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{review.summary}</p>

                  {review.strengths.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Strengths</p>
                      <ul className="text-sm list-disc pl-5">
                        {review.strengths.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {review.issues.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Fixes</p>
                      <ul className="text-sm space-y-2">
                        {review.issues.map((issue: Issue) => (
                          <li key={issue.id} className="border-l-4 pl-3" style={{ borderColor: SEVERITY_COLOR[issue.severity] ?? "var(--color-accent)" }}>
                            <span
                              className="font-data mr-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                              style={{ background: `color-mix(in srgb, ${SEVERITY_COLOR[issue.severity] ?? "var(--color-accent)"} 14%, transparent)`, color: SEVERITY_COLOR[issue.severity] }}
                            >
                              {issue.severity.toLowerCase()} · {issue.category.replace(/_/g, " ").toLowerCase()}
                            </span>
                            {issue.description}
                            <br />
                            <span style={{ color: "var(--color-text-muted)" }}>→ {issue.suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!review.atsCompatible && review.atsNotes && (
                    <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                      ATS warning: {review.atsNotes}
                    </p>
                  )}
                </div>
              ) : (
                <PendingReview cvId={cv.id} createdAtMs={cv.createdAt.getTime()} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
