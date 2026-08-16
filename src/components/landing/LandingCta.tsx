"use client";

import { ArrowUpRight } from "lucide-react";

import { landingSignIn } from "~/components/landing/landing-auth";
import { Button } from "~/components/ui/button";

export function LandingCta() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-title"
      className="relative overflow-hidden bg-[#DD5533] px-6 py-24 text-[#450E16] sm:px-10 lg:px-14 lg:py-36"
    >
      <div
        aria-hidden
        className="absolute -top-28 right-[-5%] h-80 w-80 rounded-full border-[26px] border-[#F5F9CE]/20"
      />
      <div className="relative mx-auto max-w-[1180px] text-center">
        <p className="ember-mono text-[10px] font-semibold tracking-[.2em] uppercase">
          Make the words do more
        </p>
        <h2
          id="cta-title"
          className="ember-display mx-auto mt-5 max-w-[900px] text-[clamp(3.6rem,8vw,8.4rem)] leading-[.78]"
        >
          Your next Short is already in the transcript.
        </h2>
        <Button
          variant="ember-ink"
          size="lg"
          className="mt-10 h-auto px-6 py-4"
          onClick={landingSignIn}
        >
          Try Talking Head free
          <ArrowUpRight data-icon="inline-end" className="size-[15px]" />
        </Button>
        <p className="mt-6 text-lg text-[#450E16]/65">
          Vertical talking-head Shorts only.
        </p>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t-2 border-[#F5F9CE]/20 bg-[#450E16] px-6 py-7 text-[#F5F9CE] sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-4 text-sm sm:flex-row sm:items-center">
        <span className="font-semibold">talking head</span>
        <span className="ember-mono text-[9px] tracking-[.14em] text-[#F5F9CE]/50 uppercase">
          Edit less. Say more.
        </span>
        <span className="ember-mono text-[9px] tracking-[.14em] text-[#F5F9CE]/50 uppercase">
          © 2026 Talking Head
        </span>
      </div>
    </footer>
  );
}
