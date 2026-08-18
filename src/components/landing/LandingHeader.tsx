"use client";

import { landingSignIn } from "~/components/landing/landing-auth";
import { BrandMark } from "~/components/layout/BrandMark";
import { Button } from "~/components/ui/button";

export function LandingHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-[#F5F9CE]/20 bg-[#BC2D29] text-[#F5F9CE]">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-3.5 sm:gap-6 sm:px-10 sm:py-5 lg:px-14"
      >
        <a href="#product" aria-label="YapCut home">
          <BrandMark light />
        </a>
        <div className="flex items-center gap-1 text-sm font-semibold">
          <Button
            variant="link"
            nativeButton={false}
            render={<a href="#features" />}
            className="hidden text-[#F5F9CE] opacity-75 hover:text-[#F5F9CE] hover:opacity-100 md:inline-flex"
          >
            Product
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<a href="#how-it-works" />}
            className="hidden text-[#F5F9CE] opacity-75 hover:text-[#F5F9CE] hover:opacity-100 md:inline-flex"
          >
            How it works
          </Button>
          <Button
            variant="ember"
            size="sm"
            className="h-auto px-3 py-2 shadow-[3px_3px_0_#000] hover:shadow-none"
            onClick={() => landingSignIn()}
          >
            Sign in
          </Button>
        </div>
      </nav>
    </header>
  );
}
