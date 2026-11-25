-- AlterTable
ALTER TABLE "DocumentOcrScan" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "DocumentOcrScan_success_createdAt_idx" ON "DocumentOcrScan"("success", "createdAt");
