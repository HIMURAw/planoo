// Bundles scripts/agent.ts (+ its one dependency, mysql2) into a single,
// dependency-free file at public/agent.js. Next.js serves everything under
// public/ at the site root, so this becomes reachable at
// https://planoo.xyz/agent.js with zero custom route handler needed.
//
// Customers run it with:
//   curl -s https://planoo.xyz/agent.js | node -
//
// Decided in /plan-eng-review: bundling (rather than requiring `npm install
// mysql2` on the customer's machine first) is what actually makes this a
// "single file, no setup" script — see design doc "planoo-agent v0 dağıtımı".
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/agent.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "public/agent.js",
  banner: { js: "#!/usr/bin/env node" },
});

console.log("built public/agent.js");
