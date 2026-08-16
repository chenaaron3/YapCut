"use client";

import { BrandMark } from "~/components/layout/BrandMark";
import { Button } from "~/components/ui/button";

export function LandingHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-[#F5F9CE]/20 bg-[#BC2D29] text-[#F5F9CE]">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-5 sm:px-10 lg:px-14"
      >
        <a href="#product" aria-label="YapCut home">
          <BrandMark light />
        </a>
        <div className="hidden items-center gap-1 text-sm font-semibold md:flex">
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
      </nav>
    </header>
  );
}
