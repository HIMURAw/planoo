import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// posX/posY default to 0,0 here — unlike DesignedTable's grid fallback,
// the client immediately follows up with a PATCH placing the note at the
// current viewport center (same pattern as SchemaBuilder's handleAddTable),
// so there's no need for a server-side placement guess.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { projectId?: string } | null;
  const projectId = body?.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "expected { projectId: string }" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const note = await prisma.canvasNote.create({
    data: { projectId, content: "" },
  });
  return NextResponse.json({ note });
}
