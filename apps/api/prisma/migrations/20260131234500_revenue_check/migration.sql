-- CreateEnum
CREATE TYPE "RevenueCheckStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'BYPASSED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "revenueStatus" "RevenueCheckStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Tenant" ADD COLUMN "revenueCheckedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "revenueCheckedName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "revenueCheckSource" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "revenueCheckError" TEXT;

-- CreateTable
CREATE TABLE "RevenueLookupCache" (
  "id" TEXT NOT NULL,
  "accountType" "AccountType" NOT NULL,
  "regNumber" TEXT NOT NULL,
  "name" TEXT,
  "status" "RevenueCheckStatus" NOT NULL,
  "raw" JSONB,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RevenueLookupCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevenueLookupCache_accountType_regNumber_key" ON "RevenueLookupCache"("accountType", "regNumber");
CREATE INDEX "RevenueLookupCache_checkedAt_idx" ON "RevenueLookupCache"("checkedAt");
