-- AlterEnum
ALTER TYPE "meeting_file_status" ADD VALUE 'TRANSCRIBING';

-- AlterTable
ALTER TABLE "meeting_files" ADD COLUMN     "transcription_id" TEXT;
