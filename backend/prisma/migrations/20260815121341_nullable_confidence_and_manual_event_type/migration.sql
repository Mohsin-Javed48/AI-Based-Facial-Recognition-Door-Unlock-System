-- AlterEnum
ALTER TYPE "AccessEventType" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "access_logs" ALTER COLUMN "confidence" DROP NOT NULL;
