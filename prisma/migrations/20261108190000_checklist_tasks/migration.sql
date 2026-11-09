-- CreateTable
CREATE TABLE "ChecklistTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "recurrence" TEXT NOT NULL,
    "dueDate" TEXT,
    "weekday" INTEGER,
    "monthDay" INTEGER,
    "favourite" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTask_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByUserId" TEXT,
    CONSTRAINT "ChecklistCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ChecklistTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistCompletion_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChecklistTask_storeId_active_idx" ON "ChecklistTask"("storeId", "active");

-- CreateIndex
CREATE INDEX "ChecklistTask_storeId_favourite_idx" ON "ChecklistTask"("storeId", "favourite");

-- CreateIndex
CREATE INDEX "ChecklistTask_createdAt_idx" ON "ChecklistTask"("createdAt");

-- CreateIndex
CREATE INDEX "ChecklistTask_dueDate_idx" ON "ChecklistTask"("dueDate");

-- CreateIndex
CREATE INDEX "ChecklistCompletion_dueDate_idx" ON "ChecklistCompletion"("dueDate");

-- CreateIndex
CREATE INDEX "ChecklistCompletion_completedByUserId_idx" ON "ChecklistCompletion"("completedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCompletion_taskId_dueDate_key" ON "ChecklistCompletion"("taskId", "dueDate");
