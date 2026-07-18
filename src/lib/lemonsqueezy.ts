import { createCheckout, lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import type { PlanId } from "@/lib/pricing";
import { getPlan } from "@/lib/pricing";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY,
    onError: (error) => console.error("Lemon Squeezy API error:", error.message),
  });
  configured = true;
}

/**
 * Creates a Lemon Squeezy checkout for the given plan, attributed to
 * `userId` via `checkoutData.custom` so the webhook handler can attach the
 * resulting subscription to the right account without any guessing.
 */
export async function createPlanCheckout(
  plan: Exclude<PlanId, "free">,
  userId: string,
  userEmail: string | null,
  origin: string,
): Promise<string> {
  ensureConfigured();

  const definition = getPlan(plan);
  const variantEnvVar = definition.variantEnvVar;
  if (!variantEnvVar) {
    throw new Error(`Plan "${plan}" has no Lemon Squeezy variant configured`);
  }

  const variantId = process.env[variantEnvVar];
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!variantId || !storeId) {
    throw new Error(
      `Lemon Squeezy is not configured: set LEMONSQUEEZY_STORE_ID and ${variantEnvVar} in .env`,
    );
  }

  const { data, error } = await createCheckout(storeId, variantId, {
    checkoutData: {
      email: userEmail ?? undefined,
      custom: { user_id: userId, plan },
    },
    productOptions: {
      redirectUrl: `${origin}/dashboard?checkout=success`,
    },
  });

  if (error || !data) {
    throw new Error(`Failed to create Lemon Squeezy checkout: ${error?.message ?? "unknown error"}`);
  }

  return data.data.attributes.url;
}
