import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidFigmaAccessToken, FigmaReauthRequiredError } from "@/lib/figma-client";
import { fetchFigmaFileNodes, FigmaFileFetchError } from "@/lib/figma-schema";
import { createSnapshot, getPreviousSnapshot } from "@/lib/snapshot";
import { runMatcher } from "@/lib/matcher";
import { getDbColumns } from "@/lib/schema-source";

// The main "yeniden kontrol et" action from the canvas. Figma fetch and DB
// schema are decoupled by design (design doc "Üretim hata senaryosu"): the
// DB side (schema builder tables, or an agent-pushed snapshot) is already
// durable before the user ever clicks this button, so if the Figma token
// has expired mid-flow here, nothing is lost — the client just needs the
// user to re-auth with Figma and call this route again.
//
// Project-scoped since the multi-project restructuring: the Figma file, the
// DB schema, and the resulting Links all belong to a specific Project now,
// not to the account as a whole (see schema.prisma's Project comment).
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { projectId?: string } | null;
  const projectId = body?.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "project_id_required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!project.figmaFileKey) {
    return NextResponse.json(
      { error: "no_figma_file", message: "Connect a Figma file before running a check." },
      { status: 400 },
    );
  }

  const dbColumns = await getDbColumns(userId, projectId);
  if (!dbColumns) {
    return NextResponse.json(
      {
        error: "no_db_schema",
        message: "Henüz bir veritabanı şeması yok — önce şema oluşturucudan en az bir tablo ekle.",
      },
      { status: 400 },
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidFigmaAccessToken(userId);
  } catch (err) {
    if (err instanceof FigmaReauthRequiredError) {
      return NextResponse.json(
        {
          error: "pending_figma_reauth",
          message: "Your Figma connection expired. Reconnect Figma to continue — your database schema is already saved.",
        },
        { status: 409 },
      );
    }
    throw err;
  }

  const wasFirstRun = (await getPreviousSnapshot(userId, "figma", projectId)) === null;

  let figmaNodes;
  try {
    figmaNodes = await fetchFigmaFileNodes(project.figmaFileKey, accessToken);
  } catch (err) {
    if (err instanceof FigmaFileFetchError) {
      return NextResponse.json(
        {
          error: "figma_file_fetch_failed",
          message:
            err.status === 404 || err.status === 403
              ? "Bu Figma dosyasına erişilemiyor — dosya anahtarını kontrol et ya da dosyayı Figma hesabınla paylaşıldığından emin ol."
              : "Figma dosyası okunamadı — az sonra tekrar dene.",
        },
        { status: 400 },
      );
    }
    throw err;
  }
  const figmaSnapshot = await createSnapshot(userId, "figma", figmaNodes, projectId);

  await runMatcher(userId, figmaSnapshot.id, figmaNodes, dbColumns, projectId);

  const links = await prisma.link.findMany({
    where: { userId, projectId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ links, isFirstRun: wasFirstRun });
}
