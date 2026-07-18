// Prisma 7 config — connection URL for `prisma migrate` / `prisma studio`
// lives here, not in schema.prisma. The app itself gets its connection via
// the adapter passed to PrismaClient in src/lib/prisma.ts, which is the
// actual runtime path; this file only matters for the Prisma CLI.
//
// Prisma's config loader deliberately does NOT read .env files itself
// (`dotenv: false` internally) — unlike Next.js, which loads .env.local
// automatically. This file has to do it explicitly, or `prisma migrate`/
// `prisma studio` fail with "Cannot resolve environment variable".
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
