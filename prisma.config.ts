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
import { defineConfig } from "prisma/config";

// Deliberately `process.env.DATABASE_URL` (undefined-safe), NOT prisma/
// config's `env()` helper, which throws synchronously the moment this file
// is evaluated if the var is missing. That breaks `prisma generate` — which
// doesn't need a real DB connection, just the schema — for anyone (CI, a
// fresh clone, `npm run build` in an environment with no secrets yet) who
// runs it before `.env` exists. `prisma migrate`/`studio` still fail
// loudly and correctly at actual connection time if this is undefined —
// only `generate` needed to be resilient here. (Found by an actual "why
// is prisma generate crashing" report after predev/prebuild started
// running it unconditionally — this file's env() call was the culprit.)
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
