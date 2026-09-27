-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "attachedFileName" TEXT;

-- AlterTable
ALTER TABLE "tailored_cvs" ADD COLUMN     "editReport" JSONB,
ADD COLUMN     "editedStorageKey" TEXT;
