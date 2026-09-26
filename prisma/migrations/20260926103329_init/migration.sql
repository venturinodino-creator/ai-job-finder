-- CreateEnum
CREATE TYPE "RemotePreference" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE', 'ANY');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL', 'MANAGER', 'DIRECTOR', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "CvVerdict" AS ENUM ('STRONG', 'GOOD', 'NEEDS_WORK', 'WEAK');

-- CreateEnum
CREATE TYPE "CvIssueCategory" AS ENUM ('MISSING_KEYWORDS', 'WEAK_BULLET', 'STRUCTURE', 'FORMATTING', 'ATS_COMPATIBILITY', 'QUANTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "JobSourceKind" AS ENUM ('PUBLIC_API', 'RSS', 'COMPANY_BOARD');

-- CreateEnum
CREATE TYPE "DigestChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "digestHour" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default search',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetRoles" TEXT[],
    "locations" TEXT[],
    "remotePref" "RemotePreference" NOT NULL DEFAULT 'ANY',
    "seniority" "Seniority",
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'USD',
    "industries" TEXT[],
    "languages" TEXT[],
    "activeCvId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "rawText" TEXT,
    "parsed" JSONB,
    "embedding" DOUBLE PRECISION[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_reviews" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "verdict" "CvVerdict" NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[],
    "atsCompatible" BOOLEAN NOT NULL,
    "atsNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_issues" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "category" "CvIssueCategory" NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,

    CONSTRAINT "cv_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tailored_cvs" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "rewrittenText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tailored_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "JobSourceKind" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "remoteType" "RemotePreference" NOT NULL DEFAULT 'ANY',
    "seniority" "Seniority",
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "industries" TEXT[],
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "postedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_scores" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "isWildcard" BOOLEAN NOT NULL DEFAULT false,
    "wildcardReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digestDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "channel" "DigestChannel" NOT NULL DEFAULT 'EMAIL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digest_entries" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "matchScoreId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "daily_digest_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "search_profiles_userId_idx" ON "search_profiles"("userId");

-- CreateIndex
CREATE INDEX "cvs_userId_idx" ON "cvs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cv_reviews_cvId_key" ON "cv_reviews"("cvId");

-- CreateIndex
CREATE UNIQUE INDEX "tailored_cvs_cvId_jobPostingId_key" ON "tailored_cvs"("cvId", "jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "job_sources_key_key" ON "job_sources"("key");

-- CreateIndex
CREATE INDEX "job_postings_postedAt_idx" ON "job_postings"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_sourceId_externalId_key" ON "job_postings"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "match_scores_profileId_score_idx" ON "match_scores"("profileId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "match_scores_profileId_jobPostingId_key" ON "match_scores"("profileId", "jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digests_userId_digestDate_key" ON "daily_digests"("userId", "digestDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_digest_entries_matchScoreId_key" ON "daily_digest_entries"("matchScoreId");

-- AddForeignKey
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_activeCvId_fkey" FOREIGN KEY ("activeCvId") REFERENCES "cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvs" ADD CONSTRAINT "cvs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_reviews" ADD CONSTRAINT "cv_reviews_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_issues" ADD CONSTRAINT "cv_issues_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "cv_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "job_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_scores" ADD CONSTRAINT "match_scores_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_scores" ADD CONSTRAINT "match_scores_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digests" ADD CONSTRAINT "daily_digests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_entries" ADD CONSTRAINT "daily_digest_entries_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "daily_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_entries" ADD CONSTRAINT "daily_digest_entries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digest_entries" ADD CONSTRAINT "daily_digest_entries_matchScoreId_fkey" FOREIGN KEY ("matchScoreId") REFERENCES "match_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
