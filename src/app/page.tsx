import { auth, signIn, signOut } from "@/auth";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { WhyUs } from "@/components/landing/WhyUs";
import { Features } from "@/components/landing/Features";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";

export default async function Home() {
  const session = await auth();

  async function handleSignIn() {
    "use server";
    await signIn("google");
  }

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  return (
    <div className="flex flex-1 flex-col bg-black">
      <Nav
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        user={
          session?.user
            ? {
                name: session.user.name ?? null,
                image: session.user.image ?? null,
              }
            : null
        }
      />
      <Hero onSignIn={handleSignIn} />
      <WhyUs />
      <Features />
      <Pricing onSignIn={handleSignIn} />
      <Footer />
    </div>
  );
}

