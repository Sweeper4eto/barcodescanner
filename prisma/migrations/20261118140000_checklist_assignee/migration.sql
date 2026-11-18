-- AlterTable
ALTER TABLE "ChecklistTask" ADD COLUMN "assigneeUserId" TEXT;

-- CreateIndex
CREATE INDEX "ChecklistTask_storeId_assigneeUserId_idx" ON "ChecklistTask"("storeId", "assigneeUserId");
