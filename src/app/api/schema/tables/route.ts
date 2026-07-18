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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "expected { name: string }" }, { status: 400 });
  }

  try {
    const table = await prisma.designedTable.create({
      data: { userId: session.user.id, name },
      include: { columns: true },
    });
    return NextResponse.json({ table });
  } catch {
    // Most likely the @@unique([userId, name]) constraint.
    return NextResponse.json({ error: `a table named "${name}" already exists` }, { status: 409 });
  }
}
