import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Every project gets these three lists the first time its board is opened —
// matches the fixed todo/in_progress/done set the board used to be limited
// to, now just the starting point instead of the ceiling.
const DEFAULT_COLUMN_NAMES = ["Yapılacaklar", "Devam Ediyor", "Tamamlandı"];

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
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let columns = await prisma.roadmapColumn.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });

  if (columns.length === 0) {
    await prisma.roadmapColumn.createMany({
      data: DEFAULT_COLUMN_NAMES.map((name, order) => ({ projectId, name, order })),
    });
    columns = await prisma.roadmapColumn.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
  }

  return NextResponse.json({ columns });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { projectId?: string; name?: string } | null;
  const name = body?.name?.trim();
  if (!body?.projectId || !name) {
    return NextResponse.json({ error: "missing_fields", message: "projectId ve name gerekli." }, { status: 400 });
  }
  const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const count = await prisma.roadmapColumn.count({ where: { projectId: body.projectId } });
  const column = await prisma.roadmapColumn.create({
    data: { projectId: body.projectId, name, order: count },
  });
  return NextResponse.json({ column }, { status: 201 });
}
