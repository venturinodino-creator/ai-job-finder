import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { isEmailConfigured, sendApplicationEmail } from "@/lib/email";
import { recordActivity } from "@/lib/gamification";
import { renderCvText } from "@/lib/cvDocument";
import { generateCoverNote } from "@/agents/coverNote";
import type { TailoredCvDocument } from "@/agents/cvTailor";
import type { JobSummary } from "@/agents/jobSummary";
import type { ApplicationMethod } from "@/generated/prisma/client";

const applicationInclude = {
  jobPosting: { select: { id: true, title: true, company: true, url: true, applyEmail: true } },
  tailoredCv: { select: { id: true, editedStorageKey: true } },
  cv: { select: { id: true, fileName: true } },
} as const;

/**
 * Builds (or rebuilds) the DRAFT for this user + posting: picks the active
 * CV, prefers its tailored version for this job when one exists, and drafts
 * the cover note from that text. A sent/applied application is left alone.
 */
export async function prepareApplication(userId: string, jobPostingId: string) {
  const existing = await db.application.findUnique({
    where: { userId_jobPostingId: { userId, jobPostingId } },
    include: applicationInclude,
  });
  if (existing && existing.status !== "DRAFT") return existing;

  const [user, job, profile] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.jobPosting.findUnique({ where: { id: jobPostingId } }),
    db.searchProfile.findFirst({ where: { userId, isActive: true }, include: { activeCv: true } }),
  ]);
  if (!job) throw new ApiError(404, "Job posting not found");
  const cv = profile?.activeCv;
  if (!profile || !cv) throw new ApiError(400, "Upload a CV and set it active on your search profile first.");
  if (!cv.rawText) throw new ApiError(400, "Your CV hasn't been parsed yet — re-upload it.");

  const tailored = await db.tailoredCv.findUnique({ where: { cvId_jobPostingId: { cvId: cv.id, jobPostingId } } });
  const sourceCvText = tailored?.document ? renderCvText(tailored.document as unknown as TailoredCvDocument) : cv.rawText;
  const candidateName = (cv.parsed as { name?: string | null } | null)?.name ?? user.name ?? user.email;

  const note = await generateCoverNote({
    candidateName,
    profile,
    sourceCvText,
    job,
    summary: (job.summary as unknown as JobSummary | null) ?? null,
  });

  return db.application.upsert({
    where: { userId_jobPostingId: { userId, jobPostingId } },
    create: { userId, jobPostingId, cvId: cv.id, tailoredCvId: tailored?.id ?? null, subject: note.subject, coverNote: note.body },
    update: { cvId: cv.id, tailoredCvId: tailored?.id ?? null, subject: note.subject, coverNote: note.body },
    include: applicationInclude,
  });
}

export async function updateDraft(userId: string, jobPostingId: string, patch: { subject?: string; coverNote?: string }) {
  const existing = await db.application.findUnique({ where: { userId_jobPostingId: { userId, jobPostingId } } });
  if (!existing) throw new ApiError(404, "Prepare the application first.");
  if (existing.status !== "DRAFT") throw new ApiError(400, "This application has already been sent.");
  return db.application.update({
    where: { id: existing.id },
    data: { subject: patch.subject ?? existing.subject, coverNote: patch.coverNote ?? existing.coverNote },
    include: applicationInclude,
  });
}

/**
 * EMAIL: sends the note with the chosen CV attached to the posting's address.
 * MANUAL: records that the candidate applied on the company's own site.
 * Either way the job is marked applied and the activity counts once.
 */
export async function sendApplication(userId: string, jobPostingId: string, method: ApplicationMethod) {
  const app = await db.application.findUnique({
    where: { userId_jobPostingId: { userId, jobPostingId } },
    include: { jobPosting: true, cv: true, tailoredCv: true, user: true },
  });
  if (!app) throw new ApiError(400, "Prepare the application first.");
  if (app.status !== "DRAFT") {
    return db.application.findUniqueOrThrow({ where: { id: app.id }, include: applicationInclude });
  }

  let sentTo: string | null = null;
  let sentAttachmentName: string | undefined;
  if (method === "EMAIL") {
    if (!app.jobPosting.applyEmail) throw new ApiError(400, "This posting doesn't list an application email address.");
    if (!isEmailConfigured()) throw new ApiError(400, "Email sending isn't configured on this server yet.");
    const attachment = await buildAttachment(app);
    await sendApplicationEmail({
      to: app.jobPosting.applyEmail,
      replyTo: app.user.email,
      subject: app.subject,
      text: app.coverNote,
      attachment,
    });
    sentTo = app.jobPosting.applyEmail;
    sentAttachmentName = attachment?.filename;
  }

  const attachment = method === "EMAIL" ? undefined : await buildAttachment(app);
  const updated = await db.application.update({
    where: { id: app.id },
    data: {
      status: method === "EMAIL" ? "SENT" : "APPLIED",
      method,
      sentTo,
      sentAt: new Date(),
      attachedFileName: (method === "EMAIL" ? sentAttachmentName : attachment?.filename) ?? null,
    },
    include: applicationInclude,
  });

  await db.matchScore.updateMany({
    where: { jobPostingId, profile: { userId }, appliedAt: null },
    data: { appliedAt: new Date() },
  });
  await recordActivity(userId, "JOB_APPLIED", { jobPostingId, applicationId: app.id, method });

  return updated;
}

/**
 * What goes with the application: the candidate's own CV with the accepted
 * changes applied in their layout if they generated one, otherwise the file
 * they uploaded. The generated-layout document is never attached — its
 * formatting isn't theirs.
 */
export async function buildAttachment(app: {
  jobPosting: { company: string };
  cv: { fileName: string; storageKey: string } | null;
  tailoredCv: { editedStorageKey: string | null } | null;
}): Promise<{ filename: string; content: Buffer } | undefined> {
  const storage = getStorage();
  if (app.tailoredCv?.editedStorageKey && app.cv) {
    const base = app.cv.fileName.replace(/\.docx$/i, "");
    return {
      filename: `${safeName(base)} - ${safeName(app.jobPosting.company)}.docx`,
      content: await storage.get(app.tailoredCv.editedStorageKey),
    };
  }
  if (app.cv) {
    return { filename: app.cv.fileName, content: await storage.get(app.cv.storageKey) };
  }
  return undefined;
}

/** Label for the UI describing what buildAttachment() would attach right now. */
export function describeAttachment(cv: { fileName: string } | null, tailoredCv: { editedStorageKey: string | null } | null): string {
  if (!cv) return "no CV";
  if (tailoredCv?.editedStorageKey) return `your CV with the accepted changes applied, in your own layout`;
  return `your original CV (${cv.fileName})`;
}

function safeName(value: string): string {
  return value.replace(/[^\w\s.-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "CV";
}
