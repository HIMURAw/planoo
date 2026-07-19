import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tables = await prisma.designedTable.findMany({
    where: { userId: session.user.id },
    include: { columns: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tables });
}

// Simple grid fallback so newly created tables never stack on top of each
// other on the canvas — spread out three-per-row until the user drags them
// to where they actually want them.
const GRID_COL_WIDTH = 340;
const GRID_ROW_HEIGHT = 320;
const GRID_COLS = 3;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string; projectId?: string } | null;
  const name = body?.name?.trim();
  const projectId = body?.projectId;
  if (!name || !projectId) {
    return NextResponse.json({ error: "expected { name: string, projectId: string }" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const existingCount = await prisma.designedTable.count({ where: { projectId } });
  const posX = (existingCount % GRID_COLS) * GRID_COL_WIDTH;
  const posY = Math.floor(existingCount / GRID_COLS) * GRID_ROW_HEIGHT;

  try {
    const table = await prisma.designedTable.create({
      data: { userId: session.user.id, projectId, name, posX, posY },
      include: { columns: true },
    });
    return NextResponse.json({ table });
  } catch {
    // Most likely the @@unique([userId, name]) constraint.
    return NextResponse.json({ error: `a table named "${name}" already exists` }, { status: 409 });
  }
}
