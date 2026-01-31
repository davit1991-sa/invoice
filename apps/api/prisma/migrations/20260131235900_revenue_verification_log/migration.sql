-- CreateTable
CREATE TABLE "RevenueVerificationLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" "RevenueCheckStatus" NOT NULL,
  "name" TEXT,
  "note" TEXT,
  "adminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RevenueVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevenueVerificationLog_tenantId_idx" ON "RevenueVerificationLog"("tenantId");

-- CreateIndex
CREATE INDEX "RevenueVerificationLog_createdAt_idx" ON "RevenueVerificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RevenueVerificationLog" ADD CONSTRAINT "RevenueVerificationLog_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
