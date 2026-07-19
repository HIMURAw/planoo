import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, commentId } = await params;
  const comment = await prisma.roadmapComment.findUnique({
    where: { id: commentId },
    include: { roadmapItem: { include: { project: { select: { userId: true } } } } },
  });
  if (!comment || comment.roadmapItemId !== id || comment.roadmapItem.project.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.roadmapComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
