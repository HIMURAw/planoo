import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Next.js 16: route context params are async — see AGENTS.md / Next.js 16
// upgrade notes. `context.params` must be awaited.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  if (body?.action !== "confirm" && body?.action !== "reject") {
    return NextResponse.json({ error: "expected { action: 'confirm' | 'reject' }" }, { status: 400 });
  }

  const link = await prisma.link.findUnique({ where: { id } });
  if (!link || link.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Only a `suggested` (or `stale` — a re-offered suggestion after a rename)
  // link can be confirmed/rejected here. Confirming/rejecting a `broken`
  // link isn't meaningful — the source is gone; the user resolves that by
  // deleting or re-mapping, not this endpoint.
  if (link.state !== "suggested" && link.state !== "stale") {
    return NextResponse.json(
      { error: `cannot ${body.action} a link in state "${link.state}"` },
      { status: 409 },
    );
  }

  const updated = await prisma.link.update({
    where: { id },
    data: { state: body.action === "confirm" ? "confirmed" : "rejected" },
  });

  return NextResponse.json({ link: updated });
}
