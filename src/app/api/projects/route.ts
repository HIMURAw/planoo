import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: {
          designedTables: true,
          links: true,
          roadmapItems: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name_required", message: "Proje adı gerekli." }, { status: 400 });
  }
  try {
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name,
        description: body.description?.trim() || null,
      },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "duplicate", message: "Bu isimde bir projen zaten var." }, { status: 409 });
    }
    throw e;
  }
}
