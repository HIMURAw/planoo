import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires an explicit driver adapter — there is no more built-in
// query engine binary. MariaDB's driver is Prisma's supported path for
// MySQL (there is no separate "@prisma/adapter-mysql" package).
function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({ adapter });
}

// Standard Next.js dev-mode singleton: prevents exhausting the MySQL
// connection pool from hot-reload re-instantiating PrismaClient on every
// module reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
