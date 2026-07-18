import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidFigmaAccessToken, FigmaReauthRequiredError } from "@/lib/figma-client";
import { fetchFigmaFileNodes } from "@/lib/figma-schema";
import { createSnapshot, getPreviousSnapshot } from "@/lib/snapshot";
import { runMatcher } from "@/lib/matcher";
import { getDbColumns } from "@/lib/schema-source";

// The main "yeniden kontrol et" action from the canvas. Figma fetch and DB
// schema are decoupled by design (design doc "Üretim hata senaryosu"): the
// DB side (schema builder tables, or an agent-pushed snapshot) is already
// durable before the user ever clicks this button, so if the Figma token
// has expired mid-flow here, nothing is lost — the client just needs the
// user to re-auth with Figma and call this route again.
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.figmaFileKey) {
    return NextResponse.json(
      { error: "no_figma_file", message: "Connect a Figma file before running a check." },
      { status: 400 },
    );
  }

  const dbColumns = await getDbColumns(userId);
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

  const wasFirstRun = (await getPreviousSnapshot(userId, "figma")) === null;

  const figmaNodes = await fetchFigmaFileNodes(user.figmaFileKey, accessToken);
  const figmaSnapshot = await createSnapshot(userId, "figma", figmaNodes);

  await runMatcher(userId, figmaSnapshot.id, figmaNodes, dbColumns);

  const links = await prisma.link.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ links, isFirstRun: wasFirstRun });
}
