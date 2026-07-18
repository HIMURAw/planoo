import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const [user, projects, figmaAccount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.project.findMany({
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
    }),
    prisma.account.findFirst({ where: { userId: session.user.id, provider: "figma" } }),
  ]);

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  return (
    <DashboardClient
      userName={session.user.name ?? "there"}
      userImage={session.user.image ?? null}
      plan={user?.plan ?? "free"}
      hasFigmaAccount={figmaAccount !== null}
      initialProjects={projects}
      onSignOut={handleSignOut}
    />
  );
}
