import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Figma file URLs look like https://www.figma.com/design/<fileKey>/<name> —
// accepts either the bare key or a pasted URL.
function extractFileKey(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { fileKeyOrUrl?: string } | null;
  const fileKey = body?.fileKeyOrUrl ? extractFileKey(body.fileKeyOrUrl) : null;

  if (!fileKey) {
    return NextResponse.json(
      { error: "could not parse a Figma file key from the given value" },
      { status: 400 },
    );
  }

  await prisma.user.update({ where: { id: userId }, data: { figmaFileKey: fileKey } });

  return NextResponse.json({ figmaFileKey: fileKey });
}
