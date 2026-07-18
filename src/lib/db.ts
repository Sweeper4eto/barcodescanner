import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
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
