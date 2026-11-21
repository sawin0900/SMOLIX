-- User referral fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" VARCHAR(16);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" UUID;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupIpHash" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");
CREATE INDEX IF NOT EXISTS "User_signupIpHash_idx" ON "User"("signupIpHash");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey"
    FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'GRANTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable (was missing from earlier history; local DBs often had it via db push)
CREATE TABLE IF NOT EXISTS "ReferralReward" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referrerUserId" UUID NOT NULL,
  "referredUserId" UUID NOT NULL,
  "daysGranted" INTEGER NOT NULL DEFAULT 7,
  "status" "ReferralRewardStatus" NOT NULL DEFAULT 'GRANTED',
  "grantedAt" TIMESTAMP(3),
  "rejectReason" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "status" "ReferralRewardStatus" NOT NULL DEFAULT 'GRANTED';
ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "grantedAt" TIMESTAMP(3);
ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "rejectReason" VARCHAR(120);

UPDATE "ReferralReward"
SET "grantedAt" = "createdAt"
WHERE "status" = 'GRANTED' AND "grantedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_referrerUserId_referredUserId_key"
  ON "ReferralReward"("referrerUserId", "referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralReward_referredUserId_idx" ON "ReferralReward"("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerUserId_fkey"
    FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
