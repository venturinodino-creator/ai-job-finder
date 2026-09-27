-- CreateEnum
CREATE TYPE "ApplicationMethod" AS ENUM ('EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SENT', 'APPLIED');

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "applyEmail" TEXT;

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "cvId" TEXT,
    "tailoredCvId" TEXT,
    "subject" TEXT NOT NULL,
    "coverNote" TEXT NOT NULL,
    "method" "ApplicationMethod",
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_userId_status_idx" ON "applications"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_userId_jobPostingId_key" ON "applications"("userId", "jobPostingId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_tailoredCvId_fkey" FOREIGN KEY ("tailoredCvId") REFERENCES "tailored_cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
