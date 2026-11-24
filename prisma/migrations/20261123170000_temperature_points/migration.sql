-- CreateTable
CREATE TABLE "TemperaturePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "minCelsius" REAL,
    "maxCelsius" REAL,
    "comment" TEXT,
    "commentImagePath" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemperaturePoint_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemperaturePoint_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemperatureReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pointId" TEXT NOT NULL,
    "logDate" TEXT NOT NULL,
    "celsius" REAL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByUserId" TEXT,
    CONSTRAINT "TemperatureReading_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TemperaturePoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemperatureReading_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TemperaturePoint_storeId_active_idx" ON "TemperaturePoint"("storeId", "active");

-- CreateIndex
CREATE INDEX "TemperaturePoint_createdAt_idx" ON "TemperaturePoint"("createdAt");

-- CreateIndex
CREATE INDEX "TemperatureReading_logDate_idx" ON "TemperatureReading"("logDate");

-- CreateIndex
CREATE INDEX "TemperatureReading_completedByUserId_idx" ON "TemperatureReading"("completedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TemperatureReading_pointId_logDate_key" ON "TemperatureReading"("pointId", "logDate");
