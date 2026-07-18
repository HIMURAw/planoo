import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface NewColumnBody {
  name?: string;
  dataType?: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string | null;
  referencesColumn?: string | null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: tableId } = await context.params;
  const table = await prisma.designedTable.findUnique({ where: { id: tableId } });
  if (!table || table.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as NewColumnBody | null;
  const name = body?.name?.trim();
  const dataType = body?.dataType?.trim();
  if (!name || !dataType) {
    return NextResponse.json({ error: "expected { name: string, dataType: string, ... }" }, { status: 400 });
  }

  const columnCount = await prisma.designedColumn.count({ where: { tableId } });

  try {
    const column = await prisma.designedColumn.create({
      data: {
        tableId,
        name,
        dataType,
        nullable: body?.nullable ?? true,
        isPrimaryKey: body?.isPrimaryKey ?? false,
        isForeignKey: body?.isForeignKey ?? false,
        referencesTable: body?.referencesTable ?? null,
        referencesColumn: body?.referencesColumn ?? null,
        order: columnCount,
      },
    });
    return NextResponse.json({ column });
  } catch {
    return NextResponse.json({ error: `a column named "${name}" already exists on this table` }, { status: 409 });
  }
}
