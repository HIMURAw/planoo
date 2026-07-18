import { NextResponse } from "next/server";
import { resolveAgentApiKey } from "@/lib/api-key";
import { createSnapshot } from "@/lib/snapshot";

// Receives a schema diff from scripts/agent.ts (run on the customer's own
// machine — see design doc). Auth is a single-use API key, not a session:
// the agent never does OAuth. This endpoint only ever STORES the diff; the
// matcher run happens separately when the user triggers a recheck from the
// canvas (POST /api/recheck), which reads whatever was stored here most
// recently.
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!apiKey) {
    return NextResponse.json({ error: "missing Authorization: Bearer <PLANOO_API_KEY>" }, { status: 401 });
  }

  const userId = await resolveAgentApiKey(apiKey);
  if (!userId) {
    return NextResponse.json({ error: "invalid or revoked API key" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isValidSchemaDiff(body)) {
    return NextResponse.json(
      { error: "expected { source: 'mysql', database: string, columns: array, readAt: string }" },
      { status: 400 },
    );
  }

  await createSnapshot(userId, "mysql", body);

  return NextResponse.json({ ok: true });
}

function isValidSchemaDiff(body: unknown): body is {
  source: "mysql";
  database: string;
  columns: unknown[];
  readAt: string;
} {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    candidate.source === "mysql" &&
    typeof candidate.database === "string" &&
    Array.isArray(candidate.columns) &&
    typeof candidate.readAt === "string"
  );
}
