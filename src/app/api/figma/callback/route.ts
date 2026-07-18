import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const STATE_COOKIE = "figma_oauth_state";

interface FigmaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface FigmaMeResponse {
  id: string;
}

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const origin = url.origin;

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard?figma_error=state_mismatch", origin));
  }

  const basicAuth = Buffer.from(
    `${process.env.FIGMA_CLIENT_ID}:${process.env.FIGMA_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      redirect_uri: `${origin}/api/figma/callback`,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/dashboard?figma_error=token_exchange_failed", origin));
  }

  const tokens = (await tokenResponse.json()) as FigmaTokenResponse;

  const meResponse = await fetch("https://api.figma.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meResponse.ok) {
    return NextResponse.redirect(new URL("/dashboard?figma_error=profile_fetch_failed", origin));
  }
  const figmaUser = (await meResponse.json()) as FigmaMeResponse;

  // Attach to the CURRENTLY signed-in user (session.user.id) — this is the
  // whole point of a separate connect flow instead of registering Figma as
  // an Auth.js provider: there's no ambiguity about which account this
  // belongs to, no email-matching heuristics.
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: "figma", providerAccountId: figmaUser.id } },
    create: {
      userId: session.user.id,
      type: "oauth",
      provider: "figma",
      providerAccountId: figmaUser.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      token_type: "bearer",
    },
    update: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    },
  });

  return NextResponse.redirect(new URL("/dashboard?figma_connected=1", origin));
}
