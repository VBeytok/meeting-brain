-- CreateEnum
CREATE TYPE "meeting_analysis_status" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "meeting_analyses" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "status" "meeting_analysis_status" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "action_items" JSONB,
    "decisions" JSONB,
    "language" TEXT,
    "skipped_file_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "error" TEXT,
    "generated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meeting_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_analyses_meeting_id_key" ON "meeting_analyses"("meeting_id");

-- AddForeignKey
ALTER TABLE "meeting_analyses" ADD CONSTRAINT "meeting_analyses_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
