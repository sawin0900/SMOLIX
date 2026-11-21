-- CreateTable
CREATE TABLE "ExtensionNode" (
    "id" UUID NOT NULL,
    "remnawaveNodeUuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "hostname" TEXT,
    "port" INTEGER NOT NULL DEFAULT 8443,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionNode_remnawaveNodeUuid_key" ON "ExtensionNode"("remnawaveNodeUuid");

-- CreateIndex
CREATE INDEX "ExtensionNode_isEnabled_idx" ON "ExtensionNode"("isEnabled");
