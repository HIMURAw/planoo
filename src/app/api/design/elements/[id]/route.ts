import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { AutoLayoutDirection, AutoLayoutAlign, StrokeStyle } from "@prisma/client";

interface UpdateElementBody {
  parentId?: string | null;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  fillColor?: string;
  text?: string;
  fontSize?: number | null;
  borderRadius?: number | null;
  strokeColor?: string | null;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  effects?: Prisma.InputJsonValue;
  pathData?: Prisma.InputJsonValue;
  imageData?: string | null;
  layoutMode?: AutoLayoutDirection;
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  layoutAlign?: AutoLayoutAlign;
  order?: number;
  hidden?: boolean;
  locked?: boolean;
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

  // Reparenting: the new parent must belong to the same project, and can't
  // be the element itself (a 1-hop check — deeper cycles aren't reachable
  // through the UI, which only ever reparents via top-level group/ungroup).
  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === id) {
      return NextResponse.json({ error: "an element cannot be its own parent" }, { status: 400 });
    }
    const parent = await prisma.designElement.findFirst({
      where: { id: body.parentId, projectId: existing.projectId },
    });
    if (!parent) {
      return NextResponse.json({ error: "parent element not found" }, { status: 404 });
    }
  }

  const element = await prisma.designElement.update({
    where: { id },
    data: {
      ...(body.parentId !== undefined && { parentId: body.parentId }),
      ...(body.posX !== undefined && { posX: body.posX }),
      ...(body.posY !== undefined && { posY: body.posY }),
      ...(body.width !== undefined && { width: body.width }),
      ...(body.height !== undefined && { height: body.height }),
      ...(body.rotation !== undefined && { rotation: body.rotation }),
      ...(body.opacity !== undefined && { opacity: body.opacity }),
      ...(body.fillColor !== undefined && { fillColor: body.fillColor }),
      ...(body.text !== undefined && { text: body.text }),
      ...(body.fontSize !== undefined && { fontSize: body.fontSize }),
      ...(body.borderRadius !== undefined && { borderRadius: body.borderRadius }),
      ...(body.strokeColor !== undefined && { strokeColor: body.strokeColor }),
      ...(body.strokeWidth !== undefined && { strokeWidth: body.strokeWidth }),
      ...(body.strokeStyle !== undefined && { strokeStyle: body.strokeStyle }),
      ...(body.effects !== undefined && { effects: body.effects === null ? Prisma.JsonNull : body.effects }),
      ...(body.pathData !== undefined && { pathData: body.pathData === null ? Prisma.JsonNull : body.pathData }),
      ...(body.imageData !== undefined && { imageData: body.imageData }),
      ...(body.layoutMode !== undefined && { layoutMode: body.layoutMode }),
      ...(body.layoutGap !== undefined && { layoutGap: body.layoutGap }),
      ...(body.paddingTop !== undefined && { paddingTop: body.paddingTop }),
      ...(body.paddingRight !== undefined && { paddingRight: body.paddingRight }),
      ...(body.paddingBottom !== undefined && { paddingBottom: body.paddingBottom }),
      ...(body.paddingLeft !== undefined && { paddingLeft: body.paddingLeft }),
      ...(body.layoutAlign !== undefined && { layoutAlign: body.layoutAlign }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.hidden !== undefined && { hidden: body.hidden }),
      ...(body.locked !== undefined && { locked: body.locked }),
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
