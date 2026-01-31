-- CreateEnum
CREATE TYPE "ShareDocType" AS ENUM ('INVOICE', 'ACT');

-- CreateTable
CREATE TABLE "ShareToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docType" "ShareDocType" NOT NULL,
    "docId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareToken_tokenHash_key" ON "ShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareToken_tenantId_docType_docId_idx" ON "ShareToken"("tenantId", "docType", "docId");

-- CreateIndex
CREATE INDEX "ShareToken_expiresAt_idx" ON "ShareToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "ShareToken" ADD CONSTRAINT "ShareToken_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
