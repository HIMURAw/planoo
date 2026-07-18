import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Minimal liveness+readiness check for deploy platforms/uptime monitors.
// Deliberately does NOT check Figma API reachability — that's a third
// party's uptime, not ours, and would make this endpoint flaky for reasons
// outside planoo's control.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "reachable" });
  } catch (err) {
    return NextResponse.json(
      { status: "error", db: "unreachable", message: (err as Error).message },
      { status: 503 },
    );
  }
}
