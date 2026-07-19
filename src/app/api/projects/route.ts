import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/pricing";

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
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    githubRepo?: string;
    figmaFileKey?: string;
  };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name_required", message: "Proje adı gerekli." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const plan = getPlan((user?.plan ?? "free") as PlanId);
  if (plan.projectLimit !== null) {
    const existingCount = await prisma.project.count({ where: { userId: session.user.id } });
    if (existingCount >= plan.projectLimit) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: `${plan.name} planında en fazla ${plan.projectLimit} proje oluşturabilirsin. Daha fazla proje için planını yükselt.`,
        },
        { status: 403 },
      );
    }
  }

  try {
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name,
        description: body.description?.trim() || null,
        githubRepo: body.githubRepo?.trim() || null,
        figmaFileKey: body.figmaFileKey?.trim() || null,
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
