-- CreateEnum
CREATE TYPE "meeting_file_kind" AS ENUM ('RECORDING', 'TRANSCRIPT');

-- CreateEnum
CREATE TYPE "meeting_file_status" AS ENUM ('PENDING_UPLOAD', 'QUEUED');

-- CreateTable
CREATE TABLE "meeting_files" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" "meeting_file_kind" NOT NULL,
    "status" "meeting_file_status" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meeting_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_files_storage_key_key" ON "meeting_files"("storage_key");

-- CreateIndex
CREATE INDEX "meeting_files_meeting_id_idx" ON "meeting_files"("meeting_id");

-- AddForeignKey
ALTER TABLE "meeting_files" ADD CONSTRAINT "meeting_files_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
