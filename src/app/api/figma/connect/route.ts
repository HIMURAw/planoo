import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";

const STATE_COOKIE = "figma_oauth_state";

// Starts the Figma OAuth flow for the user who is ALREADY signed in (via
// Google — see src/auth.ts). This is a "connect an integration" action, not
// a login: the resulting Figma tokens get attached to session.user.id in
// the callback route, never used to create or sign in to an account.
export async function GET(request: Request) {
  const session = await auth();
  const origin = new URL(request.url).origin;

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — this is a redirect round-trip, not a session
    path: "/",
  });

  const authorizeUrl = new URL("https://www.figma.com/oauth");
  authorizeUrl.searchParams.set("client_id", process.env.FIGMA_CLIENT_ID ?? "");
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/figma/callback`);
  authorizeUrl.searchParams.set("scope", "file_read");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorizeUrl);
}
