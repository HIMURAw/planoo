import { prisma } from "@/lib/prisma";

// Figma has no official Auth.js provider and (since /plan-ceo-review's
// Google-login restructuring) isn't an Auth.js `provider` at all anymore —
// it's connected separately via src/app/api/figma/connect + callback, which
// write directly to the same Account table Auth.js's Google provider uses.
// Refresh has to be manual either way (Auth.js's automatic refresh only
// covers first-party providers), so this lives here rather than in auth.ts.
// Docs: https://www.figma.com/developers/api#oauth2
export async function refreshFigmaAccessToken(refreshToken: string) {
  const basicAuth = Buffer.from(
    `${process.env.FIGMA_CLIENT_ID}:${process.env.FIGMA_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch("https://api.figma.com/v1/oauth/refresh", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Figma token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    // Figma refresh does not rotate the refresh token itself.
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

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

// Figma's own Retry-After on a 429 can be minutes (a real per-minute/hour
// quota reset, not a momentary blip) — honoring it verbatim turned a single
// interactive "Yeniden Kontrol Et" click into a multi-minute hang with no
// feedback, which from the user's side looks identical to the button doing
// nothing at all (found live: a recheck call sat for 3.8 minutes before
// finally resolving). Capping the wait means we fail fast with a clear
// rate-limit error instead, rather than blocking a request a human is
// sitting in front of for however long Figma says.
const MAX_RETRY_WAIT_MS = 3000;

/**
 * Wraps `fetch` against the Figma REST API with the error handling locked
 * in during /plan-ceo-review Section 2 (Error & Rescue Map):
 *   - 401 -> handled by getValidFigmaAccessToken's caller (reauth)
 *   - 429 -> bounded backoff + retry (see MAX_RETRY_WAIT_MS above)
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
      const requestedMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 1000;
      const retryAfterMs = Math.min(requestedMs, MAX_RETRY_WAIT_MS);
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      attempt += 1;
      continue;
    }

    return response;
  }
}
