-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "meeting_file_status" ADD VALUE 'READY';
ALTER TYPE "meeting_file_status" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "meeting_files" ADD COLUMN     "error" TEXT,
ADD COLUMN     "transcript" JSONB;
