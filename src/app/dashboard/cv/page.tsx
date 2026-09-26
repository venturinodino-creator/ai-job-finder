import { requireDashboardUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { CvUploadForm } from "@/components/CvUploadForm";
import { PendingReview } from "@/components/PendingReview";
import { SetActiveCvButton } from "@/components/SetActiveCvButton";
import { SignalBar } from "@/components/SignalBar";

const VERDICT_LABEL: Record<string, { text: string; tone: "secondary" | "accent" }> = {
  STRONG: { text: "Strong", tone: "secondary" },
  GOOD: { text: "Good", tone: "secondary" },
  NEEDS_WORK: { text: "Needs work", tone: "accent" },
  WEAK: { text: "Weak", tone: "accent" },
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="eyebrow">CV intelligence</p>
        <h1 className="font-display text-3xl font-semibold">Your CV</h1>
        <p className="text-sm max-w-xl" style={{ color: "var(--color-text-muted)" }}>
          PDF, DOCX or plain text, up to 10MB. We rate it and give concrete fixes right after upload.
        </p>
        <CvUploadForm />
      </div>

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
                          <li key={issue.id} className="border-l-2 pl-3" style={{ borderColor: "var(--color-accent)" }}>
                            <span className="font-medium">
                              [{issue.category.replace(/_/g, " ")} · {issue.severity}]
                            </span>{" "}
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
