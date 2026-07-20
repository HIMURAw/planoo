import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface UpdateElementBody {
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  fillColor?: string;
  text?: string;
  fontSize?: number | null;
  borderRadius?: number | null;
  order?: number;
}

async function getOwnedElement(id: string, userId: string) {
  const element = await prisma.designElement.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!element || element.project.userId !== userId) return null;
  return element;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedElement(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UpdateElementBody | null;
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const element = await prisma.designElement.update({
    where: { id },
    data: {
      ...(body.posX !== undefined && { posX: body.posX }),
      ...(body.posY !== undefined && { posY: body.posY }),
      ...(body.width !== undefined && { width: body.width }),
      ...(body.height !== undefined && { height: body.height }),
      ...(body.fillColor !== undefined && { fillColor: body.fillColor }),
      ...(body.text !== undefined && { text: body.text }),
      ...(body.fontSize !== undefined && { fontSize: body.fontSize }),
      ...(body.borderRadius !== undefined && { borderRadius: body.borderRadius }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });

  return NextResponse.json({ element });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedElement(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.designElement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
