"use client";

import { LandingCta, LandingFooter } from "~/components/landing/LandingCta";
import { LandingFeatures } from "~/components/landing/LandingFeatures";
import { LandingHeader } from "~/components/landing/LandingHeader";
import { LandingHero } from "~/components/landing/LandingHero";
import { LandingHowItWorks } from "~/components/landing/LandingHowItWorks";

export function LandingView() {
  return (
    <div className="ember-shell relative min-h-[100dvh] overflow-x-clip selection:bg-[#FFA102] selection:text-[#450E16]">
      <div
        aria-hidden
        className="ember-grain pointer-events-none fixed inset-0 z-0 opacity-30"
      />
      <LandingHeader />
      <main className="relative z-10">
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
