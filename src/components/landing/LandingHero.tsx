"use client";

import { ArrowDown, ArrowRight } from "lucide-react";

import { emberEyebrow } from "~/components/landing/landing-ui";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function LandingHero() {
  return (
    <section
      id="product"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-[#450E16] text-[#F5F9CE]"
    >
      <div
        aria-hidden
        className="ember-diagonal absolute -top-40 left-[42%] h-[640px] w-16 rotate-[-42deg] opacity-20"
      />
      <div className="relative mx-auto max-w-[1120px] px-6 py-24 sm:px-10 sm:py-32 lg:px-14 lg:py-40">
        <Badge variant="outline" className={emberEyebrow}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#FFA102]" />
          9:16 talking-head Shorts
        </Badge>
        <h1
          id="hero-title"
          className="ember-display m-0 mt-8 max-w-[920px] text-[clamp(4.2rem,10vw,9.2rem)] leading-[.78]"
        >
          Edit videos
          <br />
          <span className="text-[#FFA102]">like you read</span>
          <br />
          text.
        </h1>
        <p className="mt-8 max-w-[340px] text-lg leading-[1.25] text-[#F5F9CE]/70">
          Cut vertical talking-head Shorts from the transcript.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button
            variant="ember-cream"
            size="lg"
            nativeButton={false}
            render={<a href="#demo" />}
            className="h-auto px-5 py-3.5"
          >
            See the shortcut
            <ArrowDown data-icon="inline-end" className="size-[15px]" />
          </Button>
          <Button
            variant="ember-ghost"
            size="lg"
            nativeButton={false}
            render={<a href="#how-it-works" />}
            className="h-auto px-5 py-3.5"
          >
            How it works
            <ArrowRight data-icon="inline-end" className="size-[15px] text-[#FFA102]" />
          </Button>
        </div>
      </div>
    </section>
  );
}
