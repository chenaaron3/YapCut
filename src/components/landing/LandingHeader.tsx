"use client";

import { ArrowUpRight } from "lucide-react";

import { landingSignIn } from "~/components/landing/landing-auth";
import { BrandMark } from "~/components/layout/BrandMark";
import { Button } from "~/components/ui/button";

export function LandingHeader() {
  return (
    <header className="relative z-30 border-b border-[#F5F9CE]/20 bg-[#BC2D29] text-[#F5F9CE]">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-5 sm:px-10 lg:px-14"
      >
        <a href="#product" aria-label="Talking Head home">
          <BrandMark light />
        </a>
        <div className="hidden items-center gap-1 text-sm font-semibold md:flex">
          <Button
            variant="link"
            nativeButton={false}
            render={<a href="#demo" />}
            className="text-[#F5F9CE] opacity-75 hover:text-[#F5F9CE] hover:opacity-100"
          >
            Demo
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<a href="#features" />}
            className="text-[#F5F9CE] opacity-75 hover:text-[#F5F9CE] hover:opacity-100"
          >
            Product
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<a href="#how-it-works" />}
            className="text-[#F5F9CE] opacity-75 hover:text-[#F5F9CE] hover:opacity-100"
          >
            How it works
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Button
            variant="link"
            className="hidden text-[#F5F9CE] opacity-75 hover:text-[#F5F9CE] hover:opacity-100 sm:inline-flex"
            onClick={landingSignIn}
          >
            Sign in
          </Button>
          <Button
            variant="ember"
            size="lg"
            className="h-auto px-4 py-2.5"
            onClick={landingSignIn}
          >
            Try the editor
            <ArrowUpRight data-icon="inline-end" className="size-[15px]" />
          </Button>
        </div>
      </nav>
    </header>
  );
}
