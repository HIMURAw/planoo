import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSql } from "@/lib/schema-export";

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

  if (tables.length === 0) {
    return NextResponse.json({ error: "no tables designed yet" }, { status: 400 });
  }

  const sql = generateSql(tables);

  return new NextResponse(sql, {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schema.sql"',
    },
  });
}
