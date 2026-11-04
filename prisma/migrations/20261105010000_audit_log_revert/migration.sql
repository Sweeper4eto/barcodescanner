-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "entityType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entityId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "storeId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "payloadJson" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "revertedAt" DATETIME;
ALTER TABLE "AuditLog" ADD COLUMN "revertedByUserId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "revertsAuditId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_entityId_occurredAt_idx" ON "AuditLog"("entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_revertsAuditId_idx" ON "AuditLog"("revertsAuditId");
