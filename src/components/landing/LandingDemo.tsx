"use client";

import { Wand2 } from "lucide-react";

import { LANDING_PREVIEW } from "~/components/landing/landing-auth";
import { emberCard } from "~/components/landing/landing-ui";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function LandingDemo() {
  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="bg-[#F5F9CE] px-6 py-24 sm:px-10 lg:px-14 lg:py-32"
    >
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="ember-mono mb-3 text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
              The shortcut
            </p>
            <h2
              id="demo-title"
              className="ember-display m-0 max-w-[760px] text-[clamp(3.8rem,8vw,8rem)] leading-[.78]"
            >
              Raw in.
              <br />
              <span className="text-[#DD5533]">Ready out.</span>
            </h2>
          </div>
          <p className="max-w-[220px] text-lg leading-[1.2] text-[#432E6F]">
            One AI pass on a vertical talking-head take.
          </p>
        </div>
        <div className="mt-16 grid items-center gap-8 lg:grid-cols-[1fr_150px_1fr] lg:gap-10">
          <Card
            className={cn(
              emberCard,
              "mx-auto w-full max-w-[270px] rotate-[-2deg] bg-[#BC2D29] text-[#F5F9CE]",
            )}
          >
            <CardHeader className="ember-mono flex-row items-center justify-between border-b border-[#F5F9CE]/25 pb-3 text-[9px] tracking-[.14em] uppercase">
              <span>Before / raw</span>
              <span className="text-[#FFA102]">9:16</span>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[16px] border-2 border-[#450E16] bg-[#450E16]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="h-full w-full object-cover brightness-75 grayscale"
                  src={LANDING_PREVIEW}
                />
                <Badge
                  variant="outline"
                  className="ember-mono absolute top-4 left-4 h-auto rounded-[8px] border-[#F5F9CE]/50 bg-[#450E16]/70 text-[8px] tracking-[.12em] text-[#F5F9CE] uppercase"
                >
                  Talking head
                </Badge>
                <span className="absolute right-4 bottom-5 left-4 rounded-[8px] border border-[#F5F9CE]/25 bg-[#450E16]/75 px-3 py-2 text-lg leading-none text-[#F5F9CE]/75">
                  “um... so...”
                </span>
              </div>
            </CardContent>
            <CardFooter className="rounded-b-[22px] border-0 bg-transparent p-(--card-spacing) pt-0">
              <CardDescription className="ember-mono text-[9px] tracking-[.12em] text-[#F5F9CE]/60 uppercase">
                Filler. No flow.
              </CardDescription>
            </CardFooter>
          </Card>
          <div className="flex flex-col items-center gap-4">
            <span className="text-3xl text-[#432E6F]">→</span>
            <Button
              variant="ember"
              className="h-auto w-full max-w-[138px] flex-col gap-2 rounded-[24px] px-4 py-5 shadow-[6px_7px_0_#450E16] hover:shadow-[3px_3px_0_#450E16]"
            >
              <Wand2 className="size-[26px]" />
              <span className="ember-mono text-[10px] font-semibold tracking-[.1em] uppercase">
                One AI click
              </span>
            </Button>
            <span className="ember-mono text-[9px] tracking-[.14em] text-[#432E6F]/60 uppercase">
              starting point
            </span>
          </div>
          <Card
            className={cn(
              emberCard,
              "mx-auto w-full max-w-[270px] rotate-[2deg] bg-[#F5F9CE] text-[#450E16]",
            )}
          >
            <CardHeader className="ember-mono flex-row items-center justify-between border-b border-[#450E16]/20 pb-3 text-[9px] tracking-[.14em] uppercase">
              <span>After / ready</span>
              <span className="text-[#BC2D29]">00:28</span>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[16px] border-2 border-[#450E16] bg-[#432E6F]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="h-full w-full object-cover saturate-[1.2]"
                  src={LANDING_PREVIEW}
                />
                <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
                  <Badge className="ember-mono h-auto rounded-[8px] border-2 border-[#450E16] bg-[#2DD4BF] text-[8px] font-semibold text-[#450E16] uppercase">
                    Short
                  </Badge>
                  <Badge className="ember-mono h-auto rounded-[8px] border-2 border-[#450E16] bg-[#FFA102] text-[8px] font-semibold text-[#450E16] uppercase">
                    9:16
                  </Badge>
                </div>
                <div className="absolute right-4 bottom-5 left-4 rounded-[10px] border-2 border-[#450E16] bg-[#F5F9CE] px-3 py-3 text-center text-lg leading-none font-semibold">
                  Make it <span className="text-[#DD5533]">land.</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="rounded-b-[22px] border-0 bg-transparent p-(--card-spacing) pt-0">
              <CardDescription className="ember-mono text-[9px] tracking-[.12em] text-[#432E6F] uppercase">
                Captions · punch-in · SFX
              </CardDescription>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
