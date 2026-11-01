-- CreateTable
CREATE TABLE "RegistrationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "usedAt" DATETIME,
    "usedByUserId" TEXT,
    "usedByUsername" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "RegistrationCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCode_code_key" ON "RegistrationCode"("code");

-- CreateIndex
CREATE INDEX "RegistrationCode_usedAt_idx" ON "RegistrationCode"("usedAt");

-- CreateIndex
CREATE INDEX "RegistrationCode_createdAt_idx" ON "RegistrationCode"("createdAt");
