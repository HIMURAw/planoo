# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

planoo is a SaaS platform that bridges the gap between UI designs and database architectures. It maps Figma screens directly to database schemas, lets teams write structured blueprint notes, and unifies software development lifecycle planning (roadmap, docs, DB schema, UI design) in one place.

The MVP wedge is **UI-to-DB traceability**: automatically matching elements on Figma screens to the database tables/columns they represent, and surfacing when that mapping drifts out of date (renamed/dropped columns, changed Figma fields). Faz 0 (a pre-build validation spike) was deliberately skipped — see the design doc's "Addendum 2" update — so matching-quality and demand risk are accepted, not proven, going into this build.

## Commands

```bash
npm run dev            # start the dev server (also rebuilds public/agent.js first)
npm run build           # production build (also rebuilds public/agent.js first)
npm run start            # run a production build
npm run lint              # eslint (flat config)
npm run test               # vitest, run once (unit/integration)
npm run test:watch          # vitest, watch mode
npm run test:e2e             # playwright (starts its own dev server)
npm run agent                 # run scripts/agent.ts directly via tsx (for local testing against a real MySQL DB)
npm run prisma:generate        # regenerate the Prisma client after schema.prisma changes
npm run prisma:migrate          # create/apply a dev migration
```

**Single test file:** `npx vitest run src/lib/matcher/heuristic.test.ts` · **Single Playwright test:** `npx playwright test tests/e2e/homepage.spec.ts`

`src/lib/matcher/index.integration.test.ts` runs against a real MySQL/MariaDB (via `DATABASE_URL`) instead of mocks — it self-skips (`describe.runIf`) when `DATABASE_URL` isn't set, so it's safe in `npm run test` everywhere but only exercises anything where a DB is reachable. This is what caught a real bug during the initial build: `findRenameCandidate`'s first version used character-level similarity and failed to detect "email" -> "email_address" as a rename.

Required env vars are documented in `.env.example` — copy to `.env` for local dev (`DATABASE_URL`, `AUTH_SECRET`, `FIGMA_CLIENT_ID`/`FIGMA_CLIENT_SECRET`, `SNAPSHOT_ENCRYPTION_KEY`). `scripts/agent.ts` reads a separate set (`PLANOO_API_KEY`, `AGENT_DATABASE_URL`) — those belong on a *customer's* machine, never in this repo's own `.env`.

## Architecture

Three independently-deployable pieces, one monorepo:

1. **Next.js app** (`src/app/`) — the web UI (`src/app/page.tsx` + `src/components/canvas/`) and all backend logic, as API routes under `src/app/api/`. Auth.js (`src/auth.ts`) handles Figma OAuth via a hand-rolled custom provider (Figma has no official Auth.js provider) with `@auth/prisma-adapter` for session/token storage.
2. **`scripts/agent.ts`** — runs on a *customer's* machine/CI, never on planoo's servers. Reads their MySQL schema via raw `information_schema` queries (`mysql2`, not Prisma — kept dependency-light on purpose, see file header comment) and pushes only a schema diff to `/api/agent/push`, authenticated by a single-use API key (`PLANOO_API_KEY`), not OAuth.
3. **`public/agent.js`** — `scripts/agent.ts` bundled by `scripts/build-agent.mjs` (esbuild) into a single dependency-free file, served as a static asset. Customers run it with `curl -s https://planoo.xyz/agent.js | node -`. Regenerated automatically by the `predev`/`prebuild` npm hooks — **never edit `public/agent.js` directly**, it's gitignored and always derived from `scripts/agent.ts`.

**Data flow:** agent pushes a DB schema diff → stored as a `SchemaSnapshot` (source=`mysql`, encrypted at rest, see `src/lib/crypto.ts`) → user clicks "yeniden kontrol et" on the canvas → `/api/recheck` fetches the Figma file live, stores a second `SchemaSnapshot` (source=`figma`), and runs `src/lib/matcher/` (heuristic name/type-similarity matching, no LLM) against both → produces/updates `Link` rows shown on the React Flow canvas (`src/components/canvas/LinkCanvas.tsx`).

**`Link` state machine** (`prisma/schema.prisma`): `suggested` → `confirmed` (user action) or `rejected` (user action, never re-suggested again) or `stale`/`broken` (source renamed/deleted while confirmed — see `src/lib/matcher/index.ts` `reconcileConfirmedLinks`). Rerun scope: rematching on every recheck only touches non-`confirmed` links — a `confirmed` link is never silently overwritten by a new suggestion. `Link` rows belong to the `User`, not a `SchemaSnapshot` (deliberately — `SchemaSnapshot` retention prunes to the last 2 rows per user+source in `src/lib/snapshot.ts`, and a `confirmed` link must survive that pruning).

**Prisma 7 note:** the connection URL is *not* in `schema.prisma` (removed in Prisma 7) — it's supplied via the `@prisma/adapter-mariadb` driver adapter in `src/lib/prisma.ts` (there is no separate `@prisma/adapter-mysql` package; MariaDB's adapter is Prisma's supported MySQL path) and via `prisma.config.ts` for the CLI (`prisma migrate`/`prisma studio`).

**Next.js 16 note:** this project was scaffolded on Next.js 16, which has real breaking changes from what most training data assumes — `cookies()`, `headers()`, route `params`, and `searchParams` are all `Promise`s that must be `await`ed (see `src/app/api/links/[id]/route.ts` for the async-params pattern). `middleware.ts` is renamed `proxy.ts` if one gets added. See `AGENTS.md` and `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before assuming an older Next.js API.

## CI

`.github/workflows/ci.yml` runs lint + build + unit tests on every push/PR to `main`, with no `DATABASE_URL` secret configured on purpose — `npm run build` and `npm run test` must both succeed with no database reachable (the DB-backed integration test self-skips; `src/lib/prisma.ts` uses a lazy Proxy specifically so `next build`'s page-data-collection step, which imports every route module, doesn't need a live connection).

## Design doc

The full decision history (office-hours → CEO scope review → eng review, including two explicitly-accepted risks: skipping the pre-build validation spike, and the unvalidated core matching-heuristic assumption) lives at `~/.gstack/projects/HIMURAw-planoo/zamto-main-design-20260718-141641.md` on the machine this was built on — not part of this repo. `TODOS.md` at the repo root is the durable, repo-tracked record of deferred scope.
