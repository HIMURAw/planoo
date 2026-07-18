import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "project_id_required" }, { status: 400 });
  }
  // Verify ownership
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const items = await prisma.roadmapItem.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { projectId?: string; title?: string; description?: string; status?: string };
  if (!body.projectId || !body.title?.trim()) {
    return NextResponse.json({ error: "missing_fields", message: "projectId ve title gerekli." }, { status: 400 });
  }
  // Verify ownership
  const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const count = await prisma.roadmapItem.count({ where: { projectId: body.projectId } });
  const item = await prisma.roadmapItem.create({
    data: {
      projectId: body.projectId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      status: (body.status as "todo" | "in_progress" | "done") || "todo",
      order: count,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
