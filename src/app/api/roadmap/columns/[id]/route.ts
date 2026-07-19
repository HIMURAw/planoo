import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedColumn(id: string, userId: string) {
  const column = await prisma.roadmapColumn.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!column || column.project.userId !== userId) return null;
  return column;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await getOwnedColumn(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { name?: string; order?: number } | null;
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }
  const trimmedName = body.name?.trim();
  if (body.name !== undefined && !trimmedName) {
    return NextResponse.json({ error: "name_required", message: "Liste adı boş olamaz." }, { status: 400 });
  }
  const column = await prisma.roadmapColumn.update({
    where: { id },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });
  return NextResponse.json({ column });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await getOwnedColumn(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Cascades to its RoadmapItems (and their comments) at the DB level —
  // the client confirms with the user first, showing how many cards will
  // go with it.
  await prisma.roadmapColumn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
