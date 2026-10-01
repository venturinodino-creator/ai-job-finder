import { db } from "@/lib/db";
import type { ApplicationMethod, ApplicationStatus, IssueSeverity, RemotePreference } from "@/generated/prisma/client";

// Factories for database-backed tests. Every value is a plausible default so
// a test only states what it cares about. Rows live in the disposable test
// database (see support/testDatabase.mts) and are wiped by resetDatabase().

let counter = 0;
const next = () => `${Date.now().toString(36)}-${(counter += 1)}`;

export async function resetDatabase(): Promise<void> {
  // Users and sources are the roots; everything else cascades from them.
  await db.$executeRawUnsafe('TRUNCATE TABLE "users", "job_sources" RESTART IDENTITY CASCADE');
}

export async function seedUser(email = `user-${next()}@example.test`) {
  return db.user.create({ data: { email, passwordHash: "not-a-real-hash" } });
}

export async function seedCv(userId: string, overrides: { parsed?: boolean } = {}) {
  return db.cv.create({
    data: {
      userId,
      fileName: "cv.pdf",
      storageKey: `${userId}/cv-${next()}.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: 1234,
      rawText: "Account manager.",
      // Parsed by default: most tests want a CV the matcher can use.
      ...(overrides.parsed === false ? {} : { parsed: { skills: ["Account management"], roles: ["Account Manager"] } }),
    },
  });
}

export async function seedProfile(
  userId: string,
  overrides: { isActive?: boolean; activeCvId?: string | null; targetRoles?: string[]; locations?: string[]; remotePref?: RemotePreference } = {},
) {
  return db.searchProfile.create({
    data: {
      userId,
      name: "Search",
      targetRoles: overrides.targetRoles ?? ["Account Manager"],
      locations: overrides.locations ?? [],
      remotePref: overrides.remotePref ?? "ANY",
      isActive: overrides.isActive ?? true,
      activeCvId: overrides.activeCvId ?? null,
    },
  });
}

export async function seedSource(overrides: { lastError?: string | null; enabled?: boolean } = {}) {
  const key = `source-${next()}`;
  return db.jobSource.create({
    data: { key, name: "Test board", kind: "PUBLIC_API", baseUrl: "https://example.test", lastFetchedAt: new Date(), enabled: overrides.enabled ?? true, lastError: overrides.lastError ?? null },
  });
}

export async function seedPosting(
  sourceId: string,
  overrides: { title?: string; company?: string; location?: string | null; remoteType?: RemotePreference; postedAt?: Date; fetchedAt?: Date } = {},
) {
  const id = next();
  return db.jobPosting.create({
    data: {
      sourceId,
      externalId: `ext-${id}`,
      title: overrides.title ?? `Role ${id}`,
      company: overrides.company ?? "Acme",
      description: "A role.",
      url: `https://example.test/jobs/${id}`,
      location: overrides.location === undefined ? "Amsterdam" : overrides.location,
      remoteType: overrides.remoteType ?? "ANY",
      postedAt: overrides.postedAt ?? new Date(),
      // Postings are ingested a day before any scoring run in these tests unless a test says otherwise.
      fetchedAt: overrides.fetchedAt ?? new Date(Date.now() - 86_400_000),
    },
  });
}

export async function seedMatch(
  profileId: string,
  jobPostingId: string,
  overrides: {
    score?: number;
    isWildcard?: boolean;
    viewedAt?: Date | null;
    appliedAt?: Date | null;
    createdAt?: Date;
    locationMismatch?: boolean;
    matchedSkills?: string[];
    missingSkills?: string[];
  } = {},
) {
  return db.matchScore.create({
    data: {
      profileId,
      jobPostingId,
      score: overrides.score ?? 70,
      explanation: "Fits.",
      isWildcard: overrides.isWildcard ?? false,
      viewedAt: overrides.viewedAt ?? null,
      appliedAt: overrides.appliedAt ?? null,
      locationMismatch: overrides.locationMismatch ?? false,
      matchedSkills: overrides.matchedSkills ?? [],
      missingSkills: overrides.missingSkills ?? [],
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

export async function seedApplication(
  userId: string,
  jobPostingId: string,
  status: ApplicationStatus = "DRAFT",
  overrides: { method?: ApplicationMethod; sentAt?: Date } = {},
) {
  return db.application.create({
    data: { userId, jobPostingId, status, subject: "Application", coverNote: "Hello.", method: overrides.method ?? null, sentAt: overrides.sentAt ?? null },
  });
}

export async function seedTailoredCv(cvId: string, jobPostingId: string) {
  return db.tailoredCv.create({ data: { cvId, jobPostingId, suggestions: [] } });
}

/** A review of a CV with the given issues; `issues` lists one severity per issue. */
export async function seedReview(cvId: string, overrides: { overallScore?: number; issues?: IssueSeverity[]; createdAt?: Date } = {}) {
  return db.cvReview.create({
    data: {
      cvId,
      overallScore: overrides.overallScore ?? 70,
      verdict: "GOOD",
      summary: "A reasonable CV.",
      strengths: ["Clear"],
      atsCompatible: true,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      issues: {
        create: (overrides.issues ?? []).map((severity) => ({ category: "FORMATTING", severity, description: "An issue.", suggestion: "Fix it." })),
      },
    },
  });
}
