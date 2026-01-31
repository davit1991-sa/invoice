-- CreateEnum
CREATE TYPE "SubscriptionPlanCode" AS ENUM ('BASIC_NO_CLIENTS', 'PRO_UNLIMITED', 'PAYG_5_5');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planCode" "SubscriptionPlanCode" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "invoicesUsed" INTEGER NOT NULL DEFAULT 0,
  "actsUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeTrialIP" (
  "id" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "invoiceUsedAt" TIMESTAMP(3),
  "actUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FreeTrialIP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FreeTrialIP_ipHash_key" ON "FreeTrialIP"("ipHash");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
