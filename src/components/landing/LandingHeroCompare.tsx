"use client";

import { Pause, Play, Wand2 } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

import { emberCard } from "~/components/landing/landing-ui";
import { LandingSparkles } from "~/components/landing/LandingSparkles";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

const BEFORE_SRC = "/landing/before.mp4?v=3";
const AFTER_SRC = "/landing/after.mp4?v=2";

type Side = "before" | "after";

export function LandingHeroCompare() {
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState<Side>("before");
  const [playing, setPlaying] = useState(false);

  const playSide = (side: Side) => {
    const next = side === "before" ? beforeRef.current : afterRef.current;
    const other = side === "before" ? afterRef.current : beforeRef.current;
    if (!next) return;

    other?.pause();
    if (other) other.muted = true;

    if (next.ended) next.currentTime = 0;
    next.muted = false;
    void next.play().then(
      () => {
        setShown(side);
        setPlaying(true);
      },
      () => setPlaying(false),
    );
  };

  const switchTo = (side: Side) => {
    const next = side === "before" ? beforeRef.current : afterRef.current;
    if (next) next.currentTime = 0;
    playSide(side);
  };

  const toggleFront = () => {
    const el = shown === "before" ? beforeRef.current : afterRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      el.muted = true;
      setPlaying(false);
      return;
    }
    playSide(shown);
  };

  return (
    <div className="flex w-full max-w-[260px] flex-col items-center gap-2 sm:max-w-none sm:w-auto">
      <div className="relative h-[300px] w-full sm:h-[460px] sm:w-[340px]">
        <PhoneFrame
          side="before"
          front={shown === "before"}
          videoRef={beforeRef}
          src={BEFORE_SRC}
          playing={shown === "before" && playing}
          onToggle={toggleFront}
          onEnded={() => {
            if (shown === "before") setPlaying(false);
          }}
          className="absolute top-8 left-0 w-[58%] sm:top-10 sm:w-[220px]"
          tilt="-rotate-6"
        />
        <PhoneFrame
          side="after"
          front={shown === "after"}
          videoRef={afterRef}
          src={AFTER_SRC}
          playing={shown === "after" && playing}
          onToggle={toggleFront}
          onEnded={() => {
            if (shown === "after") setPlaying(false);
          }}
          className="absolute top-0 right-0 w-[58%] sm:w-[220px]"
          tilt="rotate-3"
          sparkles={shown === "after"}
        />
      </div>
      <Button
        variant="ember"
        size="sm"
        className="h-auto gap-1.5 rounded-[14px] px-3 py-2 shadow-[3px_3px_0_#FFA102] hover:shadow-none"
        onClick={() => switchTo(shown === "before" ? "after" : "before")}
      >
        {shown === "before" ? (
          <>
            <Wand2 className="size-3.5" />
            <span className="ember-mono text-[9px] font-semibold tracking-[.1em] uppercase">
              One AI click
            </span>
          </>
        ) : (
          <span className="ember-mono text-[9px] font-semibold tracking-[.1em] uppercase">
            See original
          </span>
        )}
      </Button>
    </div>
  );
}

function PhoneFrame({
  side,
  front,
  videoRef,
  src,
  playing,
  onToggle,
  onEnded,
  className,
  tilt,
  sparkles = false,
}: {
  side: Side;
  front: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  playing: boolean;
  onToggle: () => void;
  onEnded: () => void;
  className?: string;
  tilt: string;
  sparkles?: boolean;
}) {
  const isBefore = side === "before";

  return (
    <div
      className={cn(
        "transition-[transform,filter,opacity] duration-500 ease-out",
        front
          ? "z-20 rotate-0"
          : cn("z-10 scale-[0.96] opacity-55 grayscale", tilt),
        className,
      )}
    >
      <LandingSparkles active={sparkles} />
      <Card
        className={cn(
          emberCard,
          "pointer-events-none w-full py-3",
          isBefore
            ? "bg-[#BC2D29] text-[#F5F9CE]"
            : "bg-[#F5F9CE] text-[#450E16]",
        )}
      >
        <CardHeader
          className={cn(
            "ember-mono pb-2 text-[9px] tracking-[.14em] uppercase",
            isBefore
              ? "border-b border-[#F5F9CE]/25"
              : "border-b border-[#450E16]/20",
          )}
        >
          {isBefore ? "Before / raw" : "After / Edited"}
        </CardHeader>
        <CardContent>
          <button
            type="button"
            aria-label={playing ? `Pause ${side}` : `Play ${side}`}
            className={cn(
              "relative block aspect-[9/16] w-full overflow-hidden rounded-[16px] border-2 border-[#450E16] bg-[#450E16]",
              front ? "pointer-events-auto" : "pointer-events-none",
            )}
            onClick={onToggle}
          >
            <video
              ref={videoRef}
              src={src}
              className="h-full w-full object-cover"
              playsInline
              preload="metadata"
              onEnded={onEnded}
            />
            {front ? (
              <span className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16]">
                {playing ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5 translate-x-px" />
                )}
              </span>
            ) : null}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

