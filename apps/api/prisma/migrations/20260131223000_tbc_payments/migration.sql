-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('TBC');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
  'CREATED',
  'REDIRECT_REQUIRED',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'CANCELED',
  'WAITING_CONFIRM'
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "planCode" "SubscriptionPlanCode" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GEL',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "payId" TEXT,
  "approvalUrl" TEXT,
  "lastCallback" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_payId_key" ON "PaymentIntent"("payId");

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_idx" ON "PaymentIntent"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
