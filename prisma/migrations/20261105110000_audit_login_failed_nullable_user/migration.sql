-- Failed login audits may have no matching User (unknown username).
-- SQLite: rebuild AuditLog with nullable userId, keeping revert columns.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "deviceInfo" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" TEXT,
    "entityId" TEXT,
    "storeId" TEXT,
    "payloadJson" TEXT,
    "revertedAt" DATETIME,
    "revertedByUserId" TEXT,
    "revertsAuditId" TEXT,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_AuditLog" (
    "id",
    "userId",
    "username",
    "event",
    "ipAddress",
    "deviceInfo",
    "details",
    "occurredAt",
    "entityType",
    "entityId",
    "storeId",
    "payloadJson",
    "revertedAt",
    "revertedByUserId",
    "revertsAuditId"
)
SELECT
    "id",
    "userId",
    "username",
    "event",
    "ipAddress",
    "deviceInfo",
    "details",
    "occurredAt",
    "entityType",
    "entityId",
    "storeId",
    "payloadJson",
    "revertedAt",
    "revertedByUserId",
    "revertsAuditId"
FROM "AuditLog";

DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";

CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX "AuditLog_username_idx" ON "AuditLog"("username");
CREATE INDEX "AuditLog_entityId_occurredAt_idx" ON "AuditLog"("entityId", "occurredAt");
CREATE INDEX "AuditLog_revertsAuditId_idx" ON "AuditLog"("revertsAuditId");

PRAGMA foreign_keys=ON;
