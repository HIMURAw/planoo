import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Dashboard } from "@/components/canvas/Dashboard";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-16 text-center dark:bg-black">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          planoo
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Figma ekranlarınızdaki elementleri veritabanı tablolarınızla otomatik eşleştirin ve
          şema değiştiğinde anında haberdar olun.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("figma");
          }}
        >
          <button
            type="submit"
            className="rounded-full bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Figma ile bağlan
          </button>
        </form>
      </div>
    );
  }

  const [user, links, dbSnapshotCount, agentKeyCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.link.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.schemaSnapshot.count({ where: { userId: session.user.id, source: "mysql" } }),
    prisma.agentApiKey.count({ where: { userId: session.user.id, revokedAt: null } }),
  ]);

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  return (
    <Dashboard
      userName={session.user.name ?? "there"}
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
