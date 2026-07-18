import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface UpdateColumnBody {
  name?: string;
  dataType?: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string | null;
  referencesColumn?: string | null;
}

async function getOwnedColumn(id: string, userId: string) {
  const column = await prisma.designedColumn.findUnique({ where: { id }, include: { table: true } });
  if (!column || column.table.userId !== userId) return null;
  return column;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedColumn(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UpdateColumnBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const column = await prisma.designedColumn.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.dataType !== undefined && { dataType: body.dataType.trim() }),
      ...(body.nullable !== undefined && { nullable: body.nullable }),
      ...(body.isPrimaryKey !== undefined && { isPrimaryKey: body.isPrimaryKey }),
      ...(body.isForeignKey !== undefined && { isForeignKey: body.isForeignKey }),
      ...(body.referencesTable !== undefined && { referencesTable: body.referencesTable }),
      ...(body.referencesColumn !== undefined && { referencesColumn: body.referencesColumn }),
    },
  });

  return NextResponse.json({ column });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedColumn(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.designedColumn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
