import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Figma has no official Auth.js provider — this is a hand-rolled OAuth2
// config (decided in /plan-eng-review: Auth.js's automatic token refresh
// only works for its first-party providers, so refreshAccessToken below is
// implemented manually in the jwt callback).
// Docs: https://www.figma.com/developers/api#oauth2

interface FigmaProfile {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}

function FigmaProvider(): OAuthConfig<FigmaProfile> {
  return {
    id: "figma",
    name: "Figma",
    type: "oauth",
    authorization: {
      url: "https://www.figma.com/oauth",
      params: { scope: "file_read", response_type: "code" },
    },
    token: "https://api.figma.com/v1/oauth/token",
    userinfo: "https://api.figma.com/v1/me",
    clientId: process.env.FIGMA_CLIENT_ID,
    clientSecret: process.env.FIGMA_CLIENT_SECRET,
    profile(profile) {
      return {
        id: profile.id,
        name: profile.handle,
        email: profile.email,
        image: profile.img_url,
      };
    },
  };
}

// Refreshes an expired Figma access token using the stored refresh token.
// Called from the jwt callback below when the current token is past its
// expiry. Figma's refresh endpoint: POST /v1/oauth/refresh.
async function refreshFigmaAccessToken(refreshToken: string) {
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [FigmaProvider()],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  // NOTE: with the "database" session strategy, Account.access_token /
  // expires_at are read directly from Prisma at call time (see
  // lib/figma-client.ts), not carried in a JWT — refreshFigmaAccessToken is
  // invoked there, on-demand, right before a Figma API call whose token is
  // expired. This function is exported so that call site can use it.
  //
  // See Addendum in the design doc: this is the deliberate fix for the
  // "Auth.js refresh isn't automatic for custom providers" gap outside
  // voice found — refresh is explicit, not assumed.
});

export { refreshFigmaAccessToken };
