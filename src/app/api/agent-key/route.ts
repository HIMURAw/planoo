import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAgentApiKey } from "@/lib/api-key";

// Called from the canvas UI's "agent bağla" button. Returns the raw key
// exactly once — it is never retrievable again after this response (only
// its hash is stored, see lib/api-key.ts).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = await createAgentApiKey(session.user.id);
  return NextResponse.json({ apiKey });
}
