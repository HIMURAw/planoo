import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string; plan?: string };
  };
  data: {
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      variant_id: number;
      status: string;
      renews_at: string | null;
      ends_at: string | null;
    };
  };
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader, "utf8");

  // Lengths must match before timingSafeEqual — it throws on mismatched
  // buffer lengths rather than returning false.
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function variantIdToPlan(variantId: number): PlanTier | null {
  if (String(variantId) === process.env.LEMONSQUEEZY_SOLO_VARIANT_ID) return "solo";
  if (String(variantId) === process.env.LEMONSQUEEZY_TEAM_VARIANT_ID) return "team";
  return null;
}

// Lemon Squeezy's own recommendation (docs: "Sync with Webhooks") is to
// treat every subscription_* event the same way: re-sync the local
// Subscription row from the event's current `data.attributes`, rather than
// branching per event name (created vs. updated vs. cancelled all carry the
// full current state, just with a different `status`).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload;

  if (!payload.meta.event_name.startsWith("subscription_")) {
    // Order/license events etc. — not relevant to plan gating.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const userId = payload.meta.custom_data?.user_id;
  if (!userId) {
    console.error("Lemon Squeezy webhook missing custom_data.user_id — cannot attribute", payload.meta.event_name);
    return NextResponse.json({ error: "missing custom_data.user_id" }, { status: 400 });
  }

  const { attributes } = payload.data;
  const plan =
    (payload.meta.custom_data?.plan as PlanTier | undefined) ?? variantIdToPlan(attributes.variant_id);
  if (!plan) {
    console.error("Lemon Squeezy webhook: could not resolve plan for variant", attributes.variant_id);
    return NextResponse.json({ error: "unresolvable plan" }, { status: 400 });
  }

  const status = attributes.status as SubscriptionStatus;
  // "Active" plan states — anything else (cancelled/expired/unpaid/past_due)
  // demotes the user back to free. `paused`/`on_trial` still count as paid
  // access; Lemon Squeezy keeps billing/trialing users on their variant.
  const isEntitled = status === "active" || status === "on_trial" || status === "paused";

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status,
        lemonSqueezySubscriptionId: payload.data.id,
        lemonSqueezyCustomerId: String(attributes.customer_id),
        lemonSqueezyVariantId: String(attributes.variant_id),
        renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
        endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
      },
      update: {
        plan,
        status,
        lemonSqueezySubscriptionId: payload.data.id,
        lemonSqueezyVariantId: String(attributes.variant_id),
        renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
        endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan: isEntitled ? plan : "free" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
