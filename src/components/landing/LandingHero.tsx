"use client";

import { ArrowUpRight } from "lucide-react";

import { landingSignIn } from "~/components/landing/landing-auth";
import { emberEyebrow } from "~/components/landing/landing-ui";
import { LandingHeroCompare } from "~/components/landing/LandingHeroCompare";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function LandingHero() {
  return (
    <section
      id="product"
      aria-labelledby="hero-title"
      className="relative min-h-[100dvh] overflow-x-clip bg-[#450E16] text-[#F5F9CE] lg:h-screen lg:min-h-0"
    >
      <div
        aria-hidden
        className="ember-diagonal absolute -top-40 left-[42%] h-[640px] w-16 rotate-[-42deg] opacity-20"
      />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-5 pt-20 pb-10 sm:px-10 sm:pt-24 sm:pb-12 lg:h-full lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:px-14">
        <div className="max-w-[640px]">
          <Badge variant="outline" className={emberEyebrow}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFA102]" />
            AI-Powered
          </Badge>
          <h1
            id="hero-title"
            className="ember-display m-0 mt-5 text-[clamp(2.7rem,13vw,7.2rem)] leading-[.78] sm:mt-6 lg:text-[clamp(3.6rem,8vw,7.2rem)]"
          >
            Edit talking
            <br />
            head shorts
            <br />
            <span className="text-[#FFA102]">
              <span className="mr-3 inline-block origin-left scale-[1.16] sm:mr-10 sm:scale-[1.28]">
                10x
              </span>
              {"    "}
              faster
            </span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-[1.35] text-[#F5F9CE]/70 sm:mt-6 sm:text-lg">
            From raw talking head video to a post-ready Short in 1 click. Cut,
            caption, SFX, and more — so you can focus on building your personal
            brand.
          </p>
          <div className="mt-6 sm:mt-8">
            <Button
              variant="ember"
              size="lg"
              className="h-auto px-5 py-3.5 shadow-[4px_4px_0_#000] hover:shadow-none"
              onClick={landingSignIn}
            >
              Try for free
              <ArrowUpRight data-icon="inline-end" className="size-[15px]" />
            </Button>
          </div>
        </div>
        <div className="flex justify-center lg:block">
          <LandingHeroCompare />
        </div>
      </div>
    </section>
  );
}
