-- AlterEnum UserRole
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supportCode" VARCHAR(16);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminNote" VARCHAR(1000);

CREATE UNIQUE INDEX IF NOT EXISTS "User_supportCode_key" ON "User"("supportCode");

-- EmailVerificationToken
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AdminAuditLog
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorId" UUID NOT NULL,
  "actorEmail" VARCHAR(254) NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "targetType" VARCHAR(64),
  "targetId" VARCHAR(64),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- Coupon
CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(32) NOT NULL,
  "percentOff" INTEGER,
  "amountOff" DECIMAL(10,2),
  "bonusDays" INTEGER NOT NULL DEFAULT 0,
  "maxRedemptions" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_code_idx" ON "Coupon"("isActive", "code");

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "couponId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "orderId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_couponId_userId_key" ON "CouponRedemption"("couponId", "userId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- SignupEvent
CREATE TABLE IF NOT EXISTS "SignupEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kind" VARCHAR(32) NOT NULL,
  "ipHash" VARCHAR(64),
  "emailDomain" VARCHAR(120),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignupEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SignupEvent_kind_createdAt_idx" ON "SignupEvent"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "SignupEvent_createdAt_idx" ON "SignupEvent"("createdAt");

-- Waitlist notifiedAt (older waitlist migration may lack it)
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

-- Alert enums + AdminAlert + ProbeTarget (previously only via local db push)
DO $$ BEGIN
  CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AdminAlert" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" VARCHAR(64) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
  "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "target" VARCHAR(255),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAlert_status_createdAt_idx" ON "AdminAlert"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAlert_type_target_idx" ON "AdminAlert"("type", "target");

CREATE TABLE IF NOT EXISTS "ProbeTarget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(64) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "host" VARCHAR(255) NOT NULL,
  "port" INTEGER NOT NULL DEFAULT 443,
  "kind" VARCHAR(32) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastStatus" VARCHAR(32),
  "lastIp" VARCHAR(64),
  "lastLatencyMs" INTEGER,
  "lastBlocked" BOOLEAN,
  "lastError" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProbeTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProbeTarget_key_key" ON "ProbeTarget"("key");
CREATE INDEX IF NOT EXISTS "ProbeTarget_isActive_idx" ON "ProbeTarget"("isActive");
