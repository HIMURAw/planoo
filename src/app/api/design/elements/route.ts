import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { DesignElementType, AutoLayoutDirection, AutoLayoutAlign, StrokeStyle, Prisma } from "@prisma/client";

const VALID_TYPES: DesignElementType[] = ["rectangle", "ellipse", "text", "frame", "image", "path"];

interface CreateElementBody {
  projectId?: string;
  type?: string;
  parentId?: string | null;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  fillColor?: string;
  text?: string;
  fontSize?: number;
  borderRadius?: number;
  strokeColor?: string | null;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  effects?: Prisma.InputJsonValue;
  pathData?: Prisma.InputJsonValue;
  imageData?: string;
  layoutMode?: AutoLayoutDirection;
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  layoutAlign?: AutoLayoutAlign;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateElementBody | null;
  const projectId = body?.projectId;
  const type = body?.type;
  if (!projectId || !type || !VALID_TYPES.includes(type as DesignElementType)) {
    return NextResponse.json(
      { error: "expected { projectId: string, type: 'rectangle' | 'ellipse' | 'text' | 'frame' | 'image' | 'path', ... }" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  // If a parent is given, verify it's owned by this user/project too —
  // otherwise a crafted request could nest an element under someone else's.
  if (body?.parentId) {
    const parent = await prisma.designElement.findFirst({ where: { id: body.parentId, projectId } });
    if (!parent) {
      return NextResponse.json({ error: "parent element not found" }, { status: 404 });
    }
  }

  // Order scoped to siblings (same parentId), not the whole project —
  // matches how the layers panel and auto-layout arrangement both read it.
  const existingCount = await prisma.designElement.count({
    where: { projectId, parentId: body?.parentId ?? null },
  });

  const element = await prisma.designElement.create({
    data: {
      projectId,
      type: type as DesignElementType,
      parentId: body?.parentId ?? null,
      posX: body?.posX ?? 0,
      posY: body?.posY ?? 0,
      width: body?.width ?? 120,
      height: body?.height ?? 80,
      ...(body?.rotation !== undefined && { rotation: body.rotation }),
      ...(body?.opacity !== undefined && { opacity: body.opacity }),
      ...(body?.fillColor !== undefined && { fillColor: body.fillColor }),
      ...(body?.text !== undefined && { text: body.text }),
      ...(body?.fontSize !== undefined && { fontSize: body.fontSize }),
      ...(body?.borderRadius !== undefined && { borderRadius: body.borderRadius }),
      ...(body?.strokeColor !== undefined && { strokeColor: body.strokeColor }),
      ...(body?.strokeWidth !== undefined && { strokeWidth: body.strokeWidth }),
      ...(body?.strokeStyle !== undefined && { strokeStyle: body.strokeStyle }),
      ...(body?.effects !== undefined && { effects: body.effects }),
      ...(body?.pathData !== undefined && { pathData: body.pathData }),
      ...(body?.imageData !== undefined && { imageData: body.imageData }),
      ...(body?.layoutMode !== undefined && { layoutMode: body.layoutMode }),
      ...(body?.layoutGap !== undefined && { layoutGap: body.layoutGap }),
      ...(body?.paddingTop !== undefined && { paddingTop: body.paddingTop }),
      ...(body?.paddingRight !== undefined && { paddingRight: body.paddingRight }),
      ...(body?.paddingBottom !== undefined && { paddingBottom: body.paddingBottom }),
      ...(body?.paddingLeft !== undefined && { paddingLeft: body.paddingLeft }),
      ...(body?.layoutAlign !== undefined && { layoutAlign: body.layoutAlign }),
      order: existingCount,
    },
  });

  return NextResponse.json({ element });
}
