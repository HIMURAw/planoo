import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPlanCheckout } from "@/lib/lemonsqueezy";
import type { PlanId } from "@/lib/pricing";

const CHECKOUT_PLANS: readonly PlanId[] = ["solo", "team"];

export async function GET(request: Request) {
  const session = await auth();
  const origin = new URL(request.url).origin;

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const plan = new URL(request.url).searchParams.get("plan");
  if (!plan || !CHECKOUT_PLANS.includes(plan as PlanId)) {
    return NextResponse.json({ error: "invalid plan — expected 'solo' or 'team'" }, { status: 400 });
  }

  try {
    const checkoutUrl = await createPlanCheckout(
      plan as Exclude<PlanId, "free">,
      session.user.id,
      session.user.email ?? null,
      origin,
    );
    return NextResponse.redirect(checkoutUrl);
  } catch (err) {
    console.error("Lemon Squeezy checkout creation failed:", err);
    return NextResponse.redirect(new URL("/dashboard?checkout=error", origin));
  }
}
