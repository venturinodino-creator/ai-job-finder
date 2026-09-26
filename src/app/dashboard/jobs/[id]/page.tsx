import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { TailorCvButton } from "@/components/TailorCvButton";

interface TailorSuggestion {
  section: string;
  before: string;
  after: string;
  reason: string;
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = (await getCurrentUserId())!;

  const job = await db.jobPosting.findUnique({ where: { id }, include: { source: true } });
  if (!job) notFound();

  const [activeProfile, tailored] = await Promise.all([
    db.searchProfile.findFirst({ where: { userId, isActive: true }, include: { activeCv: true } }),
    db.tailoredCv.findFirst({ where: { jobPostingId: id, cv: { userId } } }),
  ]);
  const activeCv = activeProfile?.activeCv ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{job.title}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {job.company} · {job.location ?? "Location n/a"} · {job.remoteType} · via {job.source.name}
        </p>
        <a href={job.url} target="_blank" rel="noreferrer" className="text-sm underline">
          View original posting
        </a>
      </div>

      <div className="card whitespace-pre-wrap text-sm">{job.description.slice(0, 4000)}</div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Tailor your CV to this job</h2>
        {!activeCv ? (
          <p className="text-sm text-gray-500">Upload and activate a CV first on the CV page.</p>
        ) : (
          <TailorCvButton jobId={job.id} cvId={activeCv.id} />
        )}

        {tailored && (
          <div className="space-y-3">
            {tailored.rewrittenText && (
              <div className="card">
                <p className="text-sm font-medium mb-1">Suggested summary</p>
                <p className="text-sm">{tailored.rewrittenText}</p>
              </div>
            )}
            <div className="space-y-2">
              {(tailored.suggestions as unknown as TailorSuggestion[]).map((s, i) => (
                <div key={i} className="card text-sm">
                  <p className="font-medium">{s.section}</p>
                  <p className="text-gray-500 line-through">{s.before}</p>
                  <p>{s.after}</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Why: {s.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
