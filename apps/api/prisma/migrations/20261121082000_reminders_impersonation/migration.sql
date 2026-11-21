ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "impersonatedBy" UUID;

CREATE TABLE IF NOT EXISTS "ReminderLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "kind" VARCHAR(64) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReminderLog_userId_kind_key" ON "ReminderLog"("userId", "kind");
CREATE INDEX IF NOT EXISTS "ReminderLog_kind_sentAt_idx" ON "ReminderLog"("kind", "sentAt");

CREATE TABLE IF NOT EXISTS "ImpersonationToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tokenHash" TEXT NOT NULL,
  "targetUserId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImpersonationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImpersonationToken_tokenHash_key" ON "ImpersonationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "ImpersonationToken_expiresAt_idx" ON "ImpersonationToken"("expiresAt");
