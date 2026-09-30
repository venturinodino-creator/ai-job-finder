import { db } from "@/lib/db";
import type { ApplicationStatus, RemotePreference } from "@/generated/prisma/client";

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

export async function seedCv(userId: string) {
  return db.cv.create({
    data: { userId, fileName: "cv.pdf", storageKey: `${userId}/cv-${next()}.pdf`, mimeType: "application/pdf", fileSizeBytes: 1234, rawText: "Account manager." },
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

export async function seedSource() {
  const key = `source-${next()}`;
  return db.jobSource.create({ data: { key, name: "Test board", kind: "PUBLIC_API", baseUrl: "https://example.test" } });
}

export async function seedPosting(
  sourceId: string,
  overrides: { title?: string; company?: string; location?: string | null; remoteType?: RemotePreference; postedAt?: Date } = {},
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
    },
  });
}

export async function seedMatch(
  profileId: string,
  jobPostingId: string,
  overrides: { score?: number; isWildcard?: boolean; viewedAt?: Date | null; appliedAt?: Date | null; createdAt?: Date; locationMismatch?: boolean } = {},
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
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

export async function seedApplication(userId: string, jobPostingId: string, status: ApplicationStatus = "DRAFT") {
  return db.application.create({ data: { userId, jobPostingId, status, subject: "Application", coverNote: "Hello." } });
}

export async function seedTailoredCv(cvId: string, jobPostingId: string) {
  return db.tailoredCv.create({ data: { cvId, jobPostingId, suggestions: [] } });
}
