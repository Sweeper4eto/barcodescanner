-- CreateTable
CREATE TABLE "ChecklistFavourite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "recurrence" TEXT NOT NULL,
    "dueDate" TEXT,
    "weekday" INTEGER,
    "monthDay" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistFavourite_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate starred tasks into the favourites catalog (dedupe by storeId+title).
INSERT INTO "ChecklistFavourite" ("id", "storeId", "title", "note", "recurrence", "dueDate", "weekday", "monthDay", "createdAt", "updatedAt")
SELECT
  "id" || '-fav',
  "storeId",
  "title",
  "note",
  "recurrence",
  "dueDate",
  "weekday",
  "monthDay",
  "createdAt",
  "updatedAt"
FROM "ChecklistTask"
WHERE "favourite" = 1
  AND "active" = 1
  AND "id" IN (
    SELECT MIN("id") FROM "ChecklistTask"
    WHERE "favourite" = 1 AND "active" = 1
    GROUP BY "storeId", "title"
  );

CREATE INDEX "ChecklistFavourite_storeId_idx" ON "ChecklistFavourite"("storeId");
CREATE UNIQUE INDEX "ChecklistFavourite_storeId_title_key" ON "ChecklistFavourite"("storeId", "title");

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ChecklistTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "recurrence" TEXT NOT NULL,
    "dueDate" TEXT,
    "weekday" INTEGER,
    "monthDay" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTask_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChecklistTask" ("id", "storeId", "title", "note", "recurrence", "dueDate", "weekday", "monthDay", "active", "createdByUserId", "createdAt", "updatedAt")
SELECT "id", "storeId", "title", "note", "recurrence", "dueDate", "weekday", "monthDay", "active", "createdByUserId", "createdAt", "updatedAt" FROM "ChecklistTask";

CREATE TABLE "new_ChecklistCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByUserId" TEXT,
    CONSTRAINT "ChecklistCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "new_ChecklistTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistCompletion_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChecklistCompletion" ("id", "taskId", "dueDate", "completedAt", "completedByUserId")
SELECT "id", "taskId", "dueDate", "completedAt", "completedByUserId" FROM "ChecklistCompletion";

DROP TABLE "ChecklistCompletion";
DROP TABLE "ChecklistTask";
ALTER TABLE "new_ChecklistTask" RENAME TO "ChecklistTask";
ALTER TABLE "new_ChecklistCompletion" RENAME TO "ChecklistCompletion";

CREATE INDEX "ChecklistTask_storeId_active_idx" ON "ChecklistTask"("storeId", "active");
CREATE INDEX "ChecklistTask_createdAt_idx" ON "ChecklistTask"("createdAt");
CREATE INDEX "ChecklistTask_dueDate_idx" ON "ChecklistTask"("dueDate");
CREATE INDEX "ChecklistCompletion_dueDate_idx" ON "ChecklistCompletion"("dueDate");
CREATE INDEX "ChecklistCompletion_completedByUserId_idx" ON "ChecklistCompletion"("completedByUserId");
CREATE UNIQUE INDEX "ChecklistCompletion_taskId_dueDate_key" ON "ChecklistCompletion"("taskId", "dueDate");

PRAGMA foreign_keys=ON;
