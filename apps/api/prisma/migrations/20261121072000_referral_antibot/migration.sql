-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupIpHash" VARCHAR(64);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_signupIpHash_idx" ON "User"("signupIpHash");

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'GRANTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "status" "ReferralRewardStatus" NOT NULL DEFAULT 'GRANTED';
ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "grantedAt" TIMESTAMP(3);
ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "rejectReason" VARCHAR(120);

-- Backfill grantedAt for already paid rewards
UPDATE "ReferralReward"
SET "grantedAt" = "createdAt"
WHERE "status" = 'GRANTED' AND "grantedAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");
