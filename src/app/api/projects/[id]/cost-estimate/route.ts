import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeCostEstimate, type CostEstimateInputParams } from "@/lib/cost-estimate";
import { DEFAULT_COST_PRESET_ID } from "@/lib/cost-presets";

const DEFAULT_INPUT: CostEstimateInputParams = {
  presetId: DEFAULT_COST_PRESET_ID,
  monthlyActiveUsers: 0,
  avgRequestsPerUser: 50,
  assumedRowsPerTable: 10000,
  manualFileStorageGb: 0,
  egressGbPerMonth: 0,
};

// Rejects negative/NaN input instead of letting a bad client value produce
// a nonsensical negative-cost estimate — falls back to the previous/default
// value rather than erroring the whole request over one bad field.
function sanitizeNonNegative(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function getComputedEstimate(projectId: string, input: CostEstimateInputParams) {
  const tables = await prisma.designedTable.findMany({
    where: { projectId },
    include: { columns: true },
  });
  return computeCostEstimate(input, tables);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.costEstimateInput.findUnique({ where: { projectId } });
  const input: CostEstimateInputParams = existing ?? DEFAULT_INPUT;

  const computed = await getComputedEstimate(projectId, input);
  return NextResponse.json({ input: existing, computed });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Partial<
    Record<keyof CostEstimateInputParams, unknown>
  > | null;
  if (!body) {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const existing = await prisma.costEstimateInput.findUnique({ where: { projectId } });
  const base = existing ?? DEFAULT_INPUT;

  const merged: CostEstimateInputParams = {
    presetId: typeof body.presetId === "string" && body.presetId.trim() ? body.presetId : base.presetId,
    monthlyActiveUsers: sanitizeNonNegative(body.monthlyActiveUsers, base.monthlyActiveUsers),
    avgRequestsPerUser: sanitizeNonNegative(body.avgRequestsPerUser, base.avgRequestsPerUser),
    assumedRowsPerTable: sanitizeNonNegative(body.assumedRowsPerTable, base.assumedRowsPerTable),
    manualFileStorageGb: sanitizeNonNegative(body.manualFileStorageGb, base.manualFileStorageGb),
    egressGbPerMonth: sanitizeNonNegative(body.egressGbPerMonth, base.egressGbPerMonth),
  };

  const saved = await prisma.costEstimateInput.upsert({
    where: { projectId },
    create: { projectId, ...merged },
    update: merged,
  });

  const computed = await getComputedEstimate(projectId, merged);
  return NextResponse.json({ input: saved, computed });
}
