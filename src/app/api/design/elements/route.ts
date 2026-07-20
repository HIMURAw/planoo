import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { DesignElementType } from "@prisma/client";

const VALID_TYPES: DesignElementType[] = ["rectangle", "ellipse", "text"];

interface CreateElementBody {
  projectId?: string;
  type?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  fillColor?: string;
  text?: string;
  fontSize?: number;
  borderRadius?: number;
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
      { error: "expected { projectId: string, type: 'rectangle' | 'ellipse' | 'text', ... }" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const existingCount = await prisma.designElement.count({ where: { projectId } });

  const element = await prisma.designElement.create({
    data: {
      projectId,
      type: type as DesignElementType,
      posX: body?.posX ?? 0,
      posY: body?.posY ?? 0,
      width: body?.width ?? 120,
      height: body?.height ?? 80,
      ...(body?.fillColor !== undefined && { fillColor: body.fillColor }),
      ...(body?.text !== undefined && { text: body.text }),
      ...(body?.fontSize !== undefined && { fontSize: body.fontSize }),
      ...(body?.borderRadius !== undefined && { borderRadius: body.borderRadius }),
      order: existingCount,
    },
  });

  return NextResponse.json({ element });
}
