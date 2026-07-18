import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/canvas/Dashboard";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const [user, links, designedTables, figmaAccount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.link.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.designedTable.findMany({
      where: { userId: session.user.id },
      include: { columns: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.account.findFirst({ where: { userId: session.user.id, provider: "figma" } }),
  ]);

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  return (
    <Dashboard
      userName={session.user.name ?? "there"}
      plan={user?.plan ?? "free"}
      hasFigmaAccount={figmaAccount !== null}
      figmaFileKey={user?.figmaFileKey ?? null}
      initialDesignedTables={designedTables}
      initialLinks={links.map((l) => ({
        id: l.id,
        figmaNodeId: l.figmaNodeId,
        dbTableName: l.dbTableName,
        dbColumnName: l.dbColumnName,
        confidence: l.confidence,
        state: l.state,
      }))}
      onSignOut={handleSignOut}
    />
  );
}
