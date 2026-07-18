import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires an explicit driver adapter — there is no more built-in
// query engine binary. MariaDB's driver is Prisma's supported path for
// MySQL (there is no separate "@prisma/adapter-mysql" package).
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in a real connection string.",
    );
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

// Lazy on purpose: `next build`'s "Collecting page data" step imports every
// route module (including this one, transitively) to trace the dependency
// graph — it does NOT need a working database connection to do that. Eagerly
// constructing PrismaClient at module-evaluation time made `npm run build`
// hard-fail whenever DATABASE_URL wasn't set (CI without secrets, a fresh
// clone before `.env` exists). A Proxy defers real construction until the
// first actual property access (i.e. the first query), which only happens
// at request time, when DATABASE_URL is expected to be present.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  // No `receiver` argument on purpose: any internal getter on PrismaClient
  // must see `this` as the real client, not this Proxy, or delegate methods
  // (prisma.user.create, etc.) could break in confusing ways.
  get(_target, prop) {
    return Reflect.get(getPrisma(), prop);
  },
});
