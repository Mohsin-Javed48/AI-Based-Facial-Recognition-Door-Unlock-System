-- CreateEnum
CREATE TYPE "AccessEventType" AS ENUM ('FACE_RECOGNIZED', 'FACE_UNKNOWN');

-- CreateEnum
CREATE TYPE "GateAction" AS ENUM ('AUTO_OPENED', 'MANUAL_OPENED', 'DENIED', 'NONE');

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profile_photo" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "sample_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "member_id" TEXT,
    "matched_name" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "snapshot_path" TEXT,
    "action" "GateAction" NOT NULL,
    "event_type" "AccessEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embeddings_member_id_idx" ON "embeddings"("member_id");

-- CreateIndex
CREATE INDEX "access_logs_timestamp_idx" ON "access_logs"("timestamp");

-- CreateIndex
CREATE INDEX "access_logs_member_id_idx" ON "access_logs"("member_id");

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
