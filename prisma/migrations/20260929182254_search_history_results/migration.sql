-- AlterTable
ALTER TABLE "search_history" ADD COLUMN     "resultCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "results" JSONB;

