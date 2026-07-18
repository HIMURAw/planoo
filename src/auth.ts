import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Google is the ONLY sign-in/account-creation provider. Figma is
// deliberately NOT an Auth.js `provider` here — it's a per-user integration
// connected *after* sign-in (see src/app/api/figma/connect/route.ts), not a
// login method. Two reasons this is cleaner than registering Figma as a
// second Auth.js provider and relying on its account-linking behavior:
//   1. Auth.js only auto-links a second OAuth provider to an existing user
//      when the email matches (`allowDangerousEmailAccountLinking`) — a
//      user's Figma email and Google email are not guaranteed to match.
//   2. The connect flow explicitly attaches the Figma tokens to
//      `session.user.id` (whoever is signed in right now), which is exactly
//      what "connect your Figma account" should mean, with no ambiguity
//      about whether it's creating a new user or linking to the current one.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Called explicitly (not just `providers: [Google]`) so the env var names
  // are GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, matching .env.example and the
  // FIGMA_CLIENT_ID/SECRET naming used for the hand-rolled Figma flow —
  // rather than Auth.js's own `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
  // auto-inference convention, which would be inconsistent with that.
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
