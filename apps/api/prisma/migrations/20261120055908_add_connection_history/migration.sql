-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateTable
CREATE TABLE "ConnectionHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "serverId" TEXT,
    "mode" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectionHistory_userId_createdAt_idx" ON "ConnectionHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConnectionHistory" ADD CONSTRAINT "ConnectionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
