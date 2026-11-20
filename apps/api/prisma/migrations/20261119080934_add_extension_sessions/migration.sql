-- CreateTable
CREATE TABLE "ExtensionSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL DEFAULT 'Chrome Extension',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtensionSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionSession_tokenHash_key" ON "ExtensionSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ExtensionSession_userId_idx" ON "ExtensionSession"("userId");

-- CreateIndex
CREATE INDEX "ExtensionSession_expiresAt_idx" ON "ExtensionSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "ExtensionSession" ADD CONSTRAINT "ExtensionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
