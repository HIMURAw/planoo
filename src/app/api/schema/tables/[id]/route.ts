import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface UpdateTableBody {
  posX?: number;
  posY?: number;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const table = await prisma.designedTable.findUnique({ where: { id } });
  if (!table || table.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UpdateTableBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const updated = await prisma.designedTable.update({
    where: { id },
    data: {
      ...(body.posX !== undefined && { posX: body.posX }),
      ...(body.posY !== undefined && { posY: body.posY }),
    },
  });

  return NextResponse.json({ table: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const table = await prisma.designedTable.findUnique({ where: { id } });
  if (!table || table.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // referencesTable/referencesColumn are free-text (see DesignedColumn),
  // not a DB-level FK — deleting the table won't cascade-clear pointers
  // other columns hold into it, which would otherwise leave dangling edges
  // on the canvas pointing at a table that no longer exists.
  await prisma.designedColumn.updateMany({
    where: { table: { userId: session.user.id }, referencesTable: table.name },
    data: { isForeignKey: false, referencesTable: null, referencesColumn: null },
  });

  await prisma.designedTable.delete({ where: { id } }); // cascades to its own columns
  return NextResponse.json({ ok: true });
}
