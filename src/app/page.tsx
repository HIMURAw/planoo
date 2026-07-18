import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { WhyUs } from "@/components/landing/WhyUs";
import { Features } from "@/components/landing/Features";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  async function handleSignIn() {
    "use server";
    await signIn("google");
  }

  return (
    <div className="flex flex-1 flex-col bg-black">
      <Nav onSignIn={handleSignIn} />
      <Hero onSignIn={handleSignIn} />
      <WhyUs />
      <Features />
      <Pricing onSignIn={handleSignIn} />
      <Footer />
    </div>
  );
}
