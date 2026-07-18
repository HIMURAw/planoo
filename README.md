# planoo

A modern SaaS platform that bridges the gap between UI designs and database architectures. Map your Figma screens directly to database schemas, write structured blueprint notes, and plan your entire software development lifecycle in one place.

**MVP wedge:** UI-to-DB traceability — automatically match elements on Figma screens to the database tables/columns they represent, and surface it when that mapping drifts (a column gets renamed or dropped, a Figma field changes).

## Status

Early build. Two risks were knowingly accepted rather than resolved before writing code (see `CLAUDE.md` and the design doc for the full reasoning): the pre-build validation spike was skipped, and the core matching-heuristic assumption (Figma layer names correlate with DB column names) is unvalidated. Treat matcher accuracy and demand as open questions, not settled facts.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL, AUTH_SECRET, FIGMA_CLIENT_ID/SECRET, SNAPSHOT_ENCRYPTION_KEY
npx prisma migrate dev # creates the schema on your MySQL/MariaDB instance
npm run dev
```

You'll need:
- A local MySQL or MariaDB instance for `DATABASE_URL`.
- A Figma OAuth app (create one at [figma.com/developers/apps](https://www.figma.com/developers/apps)) for `FIGMA_CLIENT_ID`/`FIGMA_CLIENT_SECRET`. Set its callback URL to `http://localhost:3000/api/auth/callback/figma` for local dev.

See `CLAUDE.md` for architecture notes, the full command list, and how the three deployable pieces (web app, `scripts/agent.ts`, and its bundled `public/agent.js`) fit together. Deferred scope lives in `TODOS.md`.

## License

MIT — see `LICENSE`.
