/*
  Warnings:

  - A unique constraint covering the columns `[proxyUsername]` on the table `VpnAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "VpnAccount" ADD COLUMN     "proxyPasswordEncrypted" TEXT,
ADD COLUMN     "proxyProvisioned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proxyUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VpnAccount_proxyUsername_key" ON "VpnAccount"("proxyUsername");
