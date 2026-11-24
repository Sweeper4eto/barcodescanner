-- CreateTable
CREATE TABLE "DocumentOcrPaidUse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT,
    "storeId" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DocumentOcrPaidUse_createdAt_idx" ON "DocumentOcrPaidUse"("createdAt");
