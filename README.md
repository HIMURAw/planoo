# planoo

A modern SaaS platform that bridges the gap between UI designs and database architectures. Map your Figma screens directly to database schemas, write structured blueprint notes, and plan your entire software development lifecycle in one place.

**MVP wedge:** UI-to-DB traceability — automatically match elements on Figma screens to the database tables/columns they represent, and surface it when that mapping drifts (a column gets renamed or dropped, a Figma field changes).

## Status

Early build. Two risks were knowingly accepted rather than resolved before writing code (see `CLAUDE.md` and the design doc for the full reasoning): the pre-build validation spike was skipped, and the core matching-heuristic assumption (Figma layer names correlate with DB column names) is unvalidated. Treat matcher accuracy and demand as open questions, not settled facts. The pricing tiers are live (landing page + Lemon Squeezy checkout/webhook), but plan limits aren't enforced anywhere yet — see `TODOS.md`.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in every var below
npx prisma migrate dev # creates the schema on your MySQL/MariaDB instance
npm run dev
```

You'll need:
- A local MySQL or MariaDB instance for `DATABASE_URL`.
- A Google OAuth app (create one at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)) for `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. This is the only sign-in method. Redirect URI: `http://localhost:3000/api/auth/callback/google`.
- A Figma OAuth app (create one at [figma.com/developers/apps](https://www.figma.com/developers/apps)) for `FIGMA_CLIENT_ID`/`FIGMA_CLIENT_SECRET`. This is NOT for sign-in — it's connected from inside the dashboard after you're already signed in with Google. Redirect URI: `http://localhost:3000/api/figma/callback`.
- A Lemon Squeezy store (create at [lemonsqueezy.com](https://www.lemonsqueezy.com)) for `LEMONSQUEEZY_API_KEY`/`LEMONSQUEEZY_STORE_ID`, plus a product with two variants (Solo, Team) for `LEMONSQUEEZY_SOLO_VARIANT_ID`/`LEMONSQUEEZY_TEAM_VARIANT_ID`, and a webhook pointed at `/api/lemonsqueezy/webhook` (subscribe to `subscription_*` events) for `LEMONSQUEEZY_WEBHOOK_SECRET`. Free-tier signup needs none of this — only the pricing page's Solo/Team upgrade buttons do.

See `CLAUDE.md` for architecture notes, the full command list, and how the three deployable pieces (web app, `scripts/agent.ts`, and its bundled `public/agent.js`) fit together. Deferred scope lives in `TODOS.md`.

## License

MIT — see `LICENSE`.
