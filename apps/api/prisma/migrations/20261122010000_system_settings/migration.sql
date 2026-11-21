-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);
