import { PLANS } from "@/lib/pricing";

interface PricingProps {
  onSignIn: () => Promise<void>;
}

// All three CTAs sign in with Google — Lemon Squeezy checkout needs a
// userId to attach the purchase to, so upgrading past the free plan happens
// from inside the dashboard once signed in, not from this public page.
export function Pricing({ onSignIn }: PricingProps) {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Fiyatlandırma
        </h2>
        <p className="mx-auto mt-4 max-w-md text-center text-zinc-400">
          Küçük başla, büyüdükçe yükselt. Kredi kartı gerekmeden dene.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col p-8 ${
                plan.highlighted
                  ? "glass-panel border-violet-400/40! bg-linear-to-b! from-violet-500/15! to-white/5! shadow-[0_20px_60px_-15px_rgba(139,92,246,0.45)]!"
                  : "glass-panel"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-xs font-medium text-white shadow-lg shadow-violet-500/30">
                  En popüler
                </span>
              )}
              <h3 className="text-lg font-medium text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-white">{plan.priceLabel}</span>
                <span className="text-sm text-zinc-500">{plan.priceSuffix}</span>
              </div>
              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <form action={onSignIn} className="mt-8">
                <button
                  type="submit"
                  className={`w-full rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-105 ${
                    plan.highlighted
                      ? "bg-white text-black shadow-lg shadow-white/10"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
