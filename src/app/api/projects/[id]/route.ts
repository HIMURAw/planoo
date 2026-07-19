import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractFigmaFileKey } from "@/lib/figma-key";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      designedTables: { include: { columns: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } },
      links: { orderBy: { updatedAt: "desc" } },
      roadmapItems: { orderBy: { order: "asc" } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    figmaFileKey?: string;
    githubRepo?: string;
  };

  let figmaFileKey: string | null | undefined;
  if (body.figmaFileKey !== undefined) {
    figmaFileKey = body.figmaFileKey.trim() ? extractFigmaFileKey(body.figmaFileKey) : null;
    if (body.figmaFileKey.trim() && !figmaFileKey) {
      return NextResponse.json(
        { error: "invalid_figma_key", message: "Figma dosya anahtarı ya da linki geçersiz." },
        { status: 400 },
      );
    }
  }

  const project = await prisma.project.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description.trim() || null }),
      ...(figmaFileKey !== undefined && { figmaFileKey }),
      ...(body.githubRepo !== undefined && { githubRepo: body.githubRepo.trim() || null }),
    },
  });
  if (project.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const updated = await prisma.project.findUnique({ where: { id } });
  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = await prisma.project.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
