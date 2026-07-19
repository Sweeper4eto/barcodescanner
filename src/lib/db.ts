import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const configured = process.env.DATABASE_URL;
  if (!configured && process.env.NODE_ENV === "production") {
    // Never silently fall back to an empty ./dev.db in production — that yields
    // confusing "table does not exist" errors against a phantom database.
    throw new Error(
      "DATABASE_URL is not set. Refusing to start with a fallback SQLite file. " +
        "Set DATABASE_URL (e.g. file:/var/lib/magazin/data.db) in the environment/.env.",
    );
  }
  const url = configured ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  // Recreate after schema changes without a full server restart (dev hot-reload).
  // Check the newest model added to the schema so this keeps working as models are added.
  if (cached && "favouriteProduct" in cached) {
    return cached;
  }
  const client = createClient();
  globalForPrisma.prisma = client;
  return client;
}

export const db = getClient();
