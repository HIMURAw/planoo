import { prisma } from "@/lib/prisma";
import { refreshFigmaAccessToken } from "@/auth";

// Thrown when the Figma refresh token itself is invalid/revoked (not just an
// expired access token). Callers catch this specifically to move the
// in-flight recheck into `pending_figma_reauth` instead of discarding
// whatever the agent already pushed — see design doc "Üretim hata senaryosu".
export class FigmaReauthRequiredError extends Error {
  constructor(userId: string) {
    super(`Figma re-authentication required for user ${userId}`);
    this.name = "FigmaReauthRequiredError";
  }
}

const EXPIRY_SKEW_SECONDS = 60;

/**
 * Returns a valid Figma access token for the given user, refreshing it first
 * if it's expired (or about to expire). Auth.js does not do this
 * automatically for custom/non-first-party providers — this is the explicit
 * fix decided in /plan-eng-review.
 */
export async function getValidFigmaAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "figma" },
  });

  if (!account || !account.access_token) {
    throw new FigmaReauthRequiredError(userId);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isExpired =
    account.expires_at != null && account.expires_at - EXPIRY_SKEW_SECONDS <= nowSeconds;

  if (!isExpired) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new FigmaReauthRequiredError(userId);
  }

  try {
    const refreshed = await refreshFigmaAccessToken(account.refresh_token);
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: refreshed.access_token,
        expires_at: refreshed.expires_at,
      },
    });
    return refreshed.access_token;
  } catch {
    // Refresh token itself is dead — nothing short of the user re-consenting
    // via Figma OAuth will fix this.
    throw new FigmaReauthRequiredError(userId);
  }
}

interface FigmaFetchOptions {
  retriesOn429?: number;
}

/**
 * Wraps `fetch` against the Figma REST API with the error handling locked
 * in during /plan-ceo-review Section 2 (Error & Rescue Map):
 *   - 401 -> handled by getValidFigmaAccessToken's caller (reauth)
 *   - 429 -> backoff + retry
 */
export async function figmaFetch(
  path: string,
  accessToken: string,
  options: FigmaFetchOptions = {},
): Promise<Response> {
  const maxRetries = options.retriesOn429 ?? 2;
  let attempt = 0;

  while (true) {
    const response = await fetch(`https://api.figma.com/v1${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      attempt += 1;
      continue;
    }

    return response;
  }
}
