import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedItem(id: string, userId: string) {
  const item = await prisma.roadmapItem.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!item || item.project.userId !== userId) return null;
  return item;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const item = await getOwnedItem(id, session.user.id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const comments = await prisma.roadmapComment.findMany({
    where: { roadmapItemId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const item = await getOwnedItem(id, session.user.id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text_required", message: "Yorum boş olamaz." }, { status: 400 });
  }
  const comment = await prisma.roadmapComment.create({
    data: { roadmapItemId: id, text },
  });
  return NextResponse.json({ comment }, { status: 201 });
}
