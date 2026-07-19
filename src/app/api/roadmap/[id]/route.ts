import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  // Verify ownership via project
  const existing = await prisma.roadmapItem.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!existing || existing.project.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    status?: string;
    order?: number;
    label?: string | null;
    dueDate?: string | null;
  };
  const item = await prisma.roadmapItem.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description.trim() || null }),
      ...(body.status !== undefined && { status: body.status as "todo" | "in_progress" | "done" }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.label !== undefined && { label: body.label?.trim() || null }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
  });
  return NextResponse.json({ item });
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
  const existing = await prisma.roadmapItem.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!existing || existing.project.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.roadmapItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
