import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// API keys are machine-generated, high-entropy random tokens (not
// user-chosen passwords), so a single SHA-256 pass is the standard,
// sufficient approach here (same model GitHub/Stripe use for API keys —
// no need for bcrypt's deliberate slowness, which exists to slow down
// guessing *low*-entropy secrets).
function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createAgentApiKey(userId: string): Promise<string> {
  const raw = `pk_${randomBytes(24).toString("hex")}`;
  await prisma.agentApiKey.create({
    data: { userId, keyHash: hashKey(raw) },
  });
  return raw; // shown to the user exactly once — never persisted in plaintext
}

/** Returns the owning userId if the key is valid and not revoked, else null. */
export async function resolveAgentApiKey(raw: string): Promise<string | null> {
  const record = await prisma.agentApiKey.findUnique({
    where: { keyHash: hashKey(raw) },
  });
  if (!record || record.revokedAt) return null;

  await prisma.agentApiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return record.userId;
}
