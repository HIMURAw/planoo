import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/canvas/Dashboard";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const [user, links, dbSnapshotCount, agentKeyCount, figmaAccount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.link.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.schemaSnapshot.count({ where: { userId: session.user.id, source: "mysql" } }),
    prisma.agentApiKey.count({ where: { userId: session.user.id, revokedAt: null } }),
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
      hasDbSnapshot={dbSnapshotCount > 0}
      hasAgentKey={agentKeyCount > 0}
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
