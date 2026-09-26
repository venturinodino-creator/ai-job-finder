import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { CvUploadForm } from "@/components/CvUploadForm";
import { SetActiveCvButton } from "@/components/SetActiveCvButton";

const VERDICT_COLOR: Record<string, string> = {
  STRONG: "text-green-600",
  GOOD: "text-blue-600",
  NEEDS_WORK: "text-amber-600",
  WEAK: "text-red-600",
};

export default async function CvPage() {
  const userId = (await getCurrentUserId())!;
  const [cvs, profile] = await Promise.all([
    db.cv.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { review: { include: { issues: true } } },
    }),
    db.searchProfile.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);
  type CvWithReview = (typeof cvs)[number];
  type Issue = NonNullable<CvWithReview["review"]>["issues"][number];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Your CV</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          PDF, DOCX or plain text, up to 10MB. We rate it and give concrete fixes right after upload.
        </p>
        <CvUploadForm />
      </div>

      <div className="space-y-4">
        {cvs.length === 0 && <p className="text-sm text-gray-500">No CVs uploaded yet.</p>}
        {cvs.map((cv: CvWithReview) => (
          <div key={cv.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{cv.fileName}</p>
                <p className="text-xs text-gray-500">Uploaded {cv.createdAt.toDateString()}</p>
              </div>
              {profile?.activeCvId === cv.id ? (
                <span className="text-xs font-medium text-green-600">Active for search</span>
              ) : profile ? (
                <SetActiveCvButton profileId={profile.id} cvId={cv.id} />
              ) : null}
            </div>

            {cv.review ? (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">{cv.review.overallScore}/100</span>{" "}
                  <span className={VERDICT_COLOR[cv.review.verdict]}>{cv.review.verdict.replace("_", " ")}</span>
                </p>
                <p className="text-sm">{cv.review.summary}</p>

                {cv.review.strengths.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Strengths</p>
                    <ul className="text-sm list-disc pl-5">
                      {cv.review.strengths.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {cv.review.issues.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Fixes</p>
                    <ul className="text-sm space-y-2">
                      {cv.review.issues.map((issue: Issue) => (
                        <li key={issue.id} className="border-l-2 border-amber-500 pl-3">
                          <span className="font-medium">
                            [{issue.category.replace(/_/g, " ")} · {issue.severity}]
                          </span>{" "}
                          {issue.description}
                          <br />
                          <span className="text-gray-600 dark:text-gray-400">→ {issue.suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!cv.review.atsCompatible && cv.review.atsNotes && (
                  <p className="text-sm text-amber-600">ATS warning: {cv.review.atsNotes}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Review pending.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
