"use client";

import {
  ArrowRight,
  Link2,
  MousePointer2,
  Type,
  Video,
  Volume2,
  ZoomIn,
} from "lucide-react";
import { useEffect, useState } from "react";

import { LandingSparkles } from "~/components/landing/LandingSparkles";
import { cn } from "~/lib/utils";

const EDIT_SPARKLE_COLORS = [
  "#FFA102",
  "#F5F9CE",
  "#DD5533",
  "#2DD4BF",
] as const;

const TRANSCRIPT_LINES = [
  { width: "w-full", tone: "bg-[#450E16]/75", delay: "0s" },
  { width: "w-[86%]", tone: "bg-[#450E16]/45", delay: "0.45s" },
  { width: "w-[66%]", tone: "bg-[#DD5533]/75", delay: "0.9s" },
  { width: "w-[92%]", tone: "bg-[#450E16]/55", delay: "1.35s" },
] as const;

const HORMOZI_WORDS = [
  { word: "the", idle: "text-[#F5F9CE]" },
  { word: "three", idle: "text-[#F5F9CE]" },
  { word: "tricks", idle: "text-[#FFA102]" },
  { word: "that", idle: "text-[#F5F9CE]" },
  { word: "land.", idle: "text-[#DD5533]" },
] as const;

export function MockTranscripts() {
  return (
    <div
      aria-hidden
      className="relative grid h-[140px] place-items-center overflow-hidden sm:h-[160px]"
    >
      <div className="flex items-center gap-2.5 sm:gap-4">
        <div className="relative grid h-[76px] w-[54px] place-items-center rounded-[8px] border-2 border-[#FFA102] bg-[#BC2D29] shadow-[3px_4px_0_rgba(0,0,0,.24)]">
          <Video className="size-[22px] text-[#F5F9CE]" />
          <span className="ember-mono absolute right-2 bottom-2 text-[8px] tracking-[.08em] text-[#FFA102] uppercase">
            9:16
          </span>
        </div>
        <ArrowRight className="size-5 text-[#FFA102]" />
        <div className="relative h-[82px] w-[110px] rounded-[8px] border-2 border-[#450E16] bg-[#F5F9CE] p-2.5 text-[#450E16]">
          <div className="mb-2 flex items-center justify-between">
            <span className="ember-mono text-[7px] tracking-[.12em] text-[#DD5533] uppercase">
              transcript
            </span>
            <span className="ember-mono text-[7px] tracking-[.1em] text-[#450E16]/45 uppercase">
              ready
            </span>
          </div>
          <div className="space-y-2">
            {TRANSCRIPT_LINES.map((line) => (
              <span
                key={line.delay}
                className={cn(
                  "ember-line-shimmer block h-1.5 rounded-full",
                  line.width,
                  line.tone,
                )}
                style={{ animationDelay: line.delay }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MockEdits() {
  return (
    <div
      aria-hidden
      className="relative flex h-[140px] items-center justify-center overflow-hidden px-5 sm:h-[160px]"
    >
      <LandingSparkles
        active
        inset
        count={7}
        seed={11}
        colors={EDIT_SPARKLE_COLORS}
      />
      <div className="relative w-[180px] space-y-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-[124px] rounded-full bg-[#F5F9CE]/80" />
          <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[#DD5533]">
            <Type className="size-[11px] text-[#450E16]" strokeWidth={2.6} />
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-[154px] rounded-full bg-[#F5F9CE]/55" />
          <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[#2DD4BF]">
            <Volume2 className="size-[11px] text-[#450E16]" strokeWidth={2.6} />
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-[98px] rounded-full bg-[#FFA102]" />
          <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[#3B82F6]">
            <ZoomIn className="size-[11px] text-[#450E16]" strokeWidth={2.6} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function MockWordView() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let timeout = 0;
    let index = 0;

    const step = () => {
      const atEnd = index === HORMOZI_WORDS.length - 1;
      timeout = window.setTimeout(() => {
        if (atEnd) {
          setActive(-1);
          timeout = window.setTimeout(() => {
            index = 0;
            setActive(0);
            step();
          }, 3000);
          return;
        }
        index += 1;
        setActive(index);
        step();
      }, 1400);
    };

    step();
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div
      aria-hidden
      className="relative flex h-[140px] items-center justify-center overflow-hidden px-5 sm:h-[160px]"
    >
      <span className="absolute left-[18%] size-1.5 rounded-full bg-[#2DD4BF]" />
      <p className="ember-display m-0 flex max-w-[260px] flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1 text-3xl leading-[.95] sm:text-4xl">
        {HORMOZI_WORDS.map((item, i) => (
          <span
            key={item.word}
            className={cn(
              "rounded-[4px] px-1 transition-[background-color,color,transform] duration-300",
              i === active
                ? "scale-105 bg-[#FFA102] text-[#450E16]"
                : item.idle,
            )}
          >
            {item.word}
          </span>
        ))}
      </p>
      <span className="absolute right-[18%] size-1.5 rounded-full bg-[#DD5533]" />
    </div>
  );
}

export function MockControl() {
  return (
    <div
      aria-hidden
      className="relative flex h-[140px] items-end justify-center overflow-hidden px-5 pb-7 sm:h-[160px]"
    >
      <p className="ember-display m-0 flex items-baseline justify-center gap-x-2.5 text-3xl leading-none sm:text-4xl">
        <span className="text-[#F5F9CE]/45">the</span>
        <span className="relative">
          <span className="absolute bottom-[calc(100%+0.85rem)] left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[10px] border-2 border-[#450E16] bg-[#222632] p-1">
            <span className="grid h-6 w-6 place-items-center rounded-[5px] text-[#F5F9CE]/55">
              <Type className="size-[12px]" strokeWidth={2.4} />
            </span>
            <span className="grid h-6 w-6 place-items-center rounded-[5px] text-[#F5F9CE]/55">
              <Volume2 className="size-[12px]" strokeWidth={2.4} />
            </span>
            <span className="ember-glow-pulse relative grid h-6 w-6 place-items-center rounded-[5px] bg-[#3B82F6] text-[#450E16]">
              <ZoomIn className="size-[12px]" strokeWidth={2.6} />
              <MousePointer2
                className="absolute -right-1.5 -bottom-1.5 z-20 size-[18px] fill-[#F5F9CE] text-[#F5F9CE]"
                style={{ filter: "drop-shadow(2px 3px 0 #450E16)" }}
              />
            </span>
            <span className="grid h-6 w-6 place-items-center rounded-[5px] text-[#F5F9CE]/55">
              <Link2 className="size-[12px]" strokeWidth={2.4} />
            </span>
          </span>
          <span className="bg-[#3B82F6]/20 px-1 text-[#F5F9CE] underline decoration-[#3B82F6] decoration-4 underline-offset-[6px]">
            three
          </span>
        </span>
        <span className="text-[#F5F9CE]/45">tricks</span>
      </p>
    </div>
  );
}
