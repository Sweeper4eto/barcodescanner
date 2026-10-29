-- Per-user expiry remove permission (owners always allowed in app logic).
ALTER TABLE "User" ADD COLUMN "canRemoveExpiry" BOOLEAN NOT NULL DEFAULT true;
