import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface UpdateNoteBody {
  content?: string;
  posX?: number;
  posY?: number;
}

async function getOwnedNote(id: string, userId: string) {
  const note = await prisma.canvasNote.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!note || note.project.userId !== userId) return null;
  return note;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedNote(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UpdateNoteBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const note = await prisma.canvasNote.update({
    where: { id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.posX !== undefined && { posX: body.posX }),
      ...(body.posY !== undefined && { posY: body.posY }),
    },
  });

  return NextResponse.json({ note });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedNote(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.canvasNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
