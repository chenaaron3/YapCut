"use client";

import { Check, Share2, Upload } from "lucide-react";
import { useRef } from "react";

import { StoryCursor } from "~/components/landing/StoryCursor";
import {
  lerp,
  spanProgress,
  useElementPercent,
} from "~/components/landing/use-story-progress";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { Ref } from "react";

const TRANSCRIPT_WORDS = [
  { word: "The" },
  { word: "idea", mark: "emphasis" },
  { word: "is" },
  { word: "already", mark: "zoom" },
  { word: "there." },
  { word: "You" },
  { word: "just" },
  { word: "have" },
  { word: "to" },
  { word: "make" },
  { word: "it" },
  { word: "land.", mark: "sfx" },
] as const;

const MARKS = [
  {
    id: "zoom",
    label: "zoom",
    color: "#3B82F6",
    text: "#2563EB",
    fill: "59 130 246",
  },
  {
    id: "sfx",
    label: "sfx",
    color: "#2DD4BF",
    text: "#087F77",
    fill: "45 212 191",
  },
  {
    id: "emphasis",
    label: "emphasis",
    color: "#DD5533",
    text: "#BC2D29",
    fill: "221 85 51",
  },
] as const;

type MarkId = (typeof MARKS)[number]["id"];

const MARK_BEATS: Record<MarkId, [number, number]> = {
  zoom: [0.48, 0.62],
  sfx: [0.64, 0.78],
  emphasis: [0.8, 0.94],
};

function markAmount(progress: number, id: MarkId) {
  const beat = MARK_BEATS[id];
  return spanProgress(progress, beat[0], beat[1]);
}

function PanelHeader({
  label,
  badge,
  tone,
  badgeTone,
}: {
  label: string;
  badge: string;
  tone: "teal" | "orange" | "purple" | "gold";
  badgeTone?: "teal" | "orange" | "purple" | "gold";
}) {
  const tones = {
    teal: {
      label: "text-[#2DD4BF]",
      badge: "border-[#2DD4BF]/55 text-[#9DEEE1]",
    },
    gold: {
      label: "text-[#FFA102]",
      badge: "border-[#FFA102]/55 text-[#FFA102]",
    },
    orange: {
      label: "text-[#DD5533]",
      badge: "border-[#DD5533]/55 text-[#FFB3A1]",
    },
    purple: {
      label: "text-[#A78BFA]",
      badge: "border-[#A78BFA]/55 text-[#D9CCFF]",
    },
  } as const;

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 sm:gap-4">
      <p
        className={cn(
          "ember-mono m-0 text-[10px] tracking-[.18em] uppercase",
          tones[tone].label,
        )}
      >
        {label}
      </p>
      <span
        className={cn(
          "ember-mono rounded-full border px-3 py-2 text-[9px] tracking-[.12em] uppercase",
          tones[badgeTone ?? tone].badge,
        )}
      >
        {badge}
      </span>
    </div>
  );
}

function PanelFooter({ children }: { children: string }) {
  return (
    <p className="ember-mono m-0 shrink-0 text-center text-[9px] tracking-[.16em] text-[#F5F9CE]/45 uppercase">
      {children}
    </p>
  );
}

const RAW_CLIP_SRC = "/landing/before.mp4?v=3";
const EDITED_CLIP_SRC = "/landing/after.mp4?v=2";

function RawClip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "aspect-9/16 overflow-hidden rounded-[12px] border-2 border-[#FFA102] bg-[#432E6F] shadow-[4px_5px_0_rgba(69,14,22,.55)]",
        className,
      )}
    >
      <video
        aria-hidden
        autoPlay
        className="h-full w-full object-cover"
        loop
        muted
        playsInline
        src={RAW_CLIP_SRC}
      />
    </div>
  );
}

function MarkBadge({
  mark,
  amount,
}: {
  mark: (typeof MARKS)[number];
  amount: number;
}) {
  return (
    <span
      className="ember-mono rounded-[6px] border px-2 py-1 text-[8px] tracking-[.1em] uppercase"
      style={{
        borderColor: mark.color,
        color: mark.text,
        background: `rgb(${mark.fill} / ${0.08 + amount * 0.16})`,
        opacity: 0.28 + amount * 0.72,
        transform: `translateY(${(1 - amount) * 6}px)`,
      }}
    >
      {mark.label}
    </span>
  );
}

function HighlightedWord({
  word,
  mark,
  appear,
  amount,
  wordRef,
}: {
  word: string;
  mark?: MarkId;
  appear: number;
  amount: number;
  wordRef?: Ref<HTMLSpanElement>;
}) {
  const style = mark ? MARKS.find((item) => item.id === mark) : undefined;

  return (
    <span
      ref={wordRef}
      className="inline-block rounded-[8px] px-1"
      style={{
        opacity: appear,
        transform: `translateY(${(1 - appear) * 10}px)`,
        color: style && amount > 0.2 ? style.text : "#450E16",
        background:
          style && amount > 0
            ? `rgb(${style.fill} / ${amount * 0.2})`
            : undefined,
        boxShadow:
          style && amount > 0.45 ? `inset 0 0 0 1px ${style.color}` : undefined,
      }}
    >
      {word}
    </span>
  );
}

function wordTreatment(
  word: string,
  amounts: Record<MarkId, number>,
  zoomAlready: number,
  zoomThere: number,
): { mark?: MarkId; amount: number } {
  if (word === "already") return { mark: "zoom", amount: zoomAlready };
  if (word === "there.") return { mark: "zoom", amount: zoomThere };
  const item = TRANSCRIPT_WORDS.find((entry) => entry.word === word);
  if (item && "mark" in item) {
    return { mark: item.mark, amount: amounts[item.mark] };
  }
  return { amount: 0 };
}

function TranscriptCard({
  progress,
  zoomAlready,
  zoomThere,
  animateWords,
  wordRefs,
}: {
  progress: number;
  zoomAlready: number;
  zoomThere: number;
  animateWords: boolean;
  wordRefs?: Partial<Record<"already" | "there.", Ref<HTMLSpanElement>>>;
}) {
  const amounts = {
    zoom: markAmount(progress, "zoom"),
    sfx: animateWords ? markAmount(progress, "sfx") : 1,
    emphasis: animateWords ? markAmount(progress, "emphasis") : 1,
  };

  return (
    <div className="w-full rounded-[14px] border-2 border-[#450E16] bg-[#F5F9CE] p-3.5 text-[#450E16] shadow-[6px_7px_0_rgba(0,0,0,.18)] sm:p-5">
      <div className="ember-mono mb-5 flex items-center justify-between text-[8px] tracking-[.14em] text-[#DD5533] uppercase">
        <span>transcript</span>
        <span className="text-[#450E16]/40">00:08</span>
      </div>
      <p className="m-0 flex flex-wrap gap-x-1.5 gap-y-2 text-[clamp(1.35rem,3.1vw,2rem)] leading-[1.15]">
        {TRANSCRIPT_WORDS.map((item, i) => {
          const appear = animateWords
            ? spanProgress(
                progress,
                (i / TRANSCRIPT_WORDS.length) * 0.4,
                ((i + 1) / TRANSCRIPT_WORDS.length) * 0.4 + 0.04,
              )
            : 1;
          const treatment = wordTreatment(
            item.word,
            amounts,
            zoomAlready,
            zoomThere,
          );
          return (
            <HighlightedWord
              key={`${item.word}-${i}`}
              word={item.word}
              mark={treatment.mark}
              appear={appear}
              amount={treatment.amount}
              wordRef={
                item.word === "already" || item.word === "there."
                  ? wordRefs?.[item.word]
                  : undefined
              }
            />
          );
        })}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {MARKS.map((mark) => (
          <MarkBadge
            key={mark.id}
            mark={mark}
            amount={animateWords ? amounts[mark.id] : 1}
          />
        ))}
      </div>
    </div>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <defs>
        <linearGradient id="story-ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="48%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#story-ig)" />
      <circle
        cx="12"
        cy="12"
        r="4.1"
        fill="none"
        stroke="#F5F9CE"
        strokeWidth="1.7"
      />
      <circle cx="17.1" cy="6.9" r="1.05" fill="#F5F9CE" />
    </svg>
  );
}

function YouTubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect x="1.2" y="5.2" width="21.6" height="13.6" rx="4" fill="#FF0000" />
      <path d="M10.2 9.2v5.6l5.4-2.8z" fill="#F5F9CE" />
    </svg>
  );
}

function TikTokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <path
        d="M14.6 3.2v9.6a3.4 3.4 0 1 1-3.3-3.4"
        fill="none"
        stroke="#25F4EE"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
      <path
        d="M16.6 3.4c.7 3 2.5 4.7 5 5.3"
        fill="none"
        stroke="#25F4EE"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
      <path
        d="M13.8 3.8v9.6a3.4 3.4 0 1 1-3.3-3.4"
        fill="none"
        stroke="#111"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
      <path
        d="M15.8 4c.7 3 2.5 4.7 5 5.3"
        fill="none"
        stroke="#111"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
      <path
        d="M13 4.2v9.6a3.4 3.4 0 1 1-3.3-3.4"
        fill="none"
        stroke="#FE2C55"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
      <path
        d="M15 4.4c.7 3 2.5 4.7 5 5.3"
        fill="none"
        stroke="#FE2C55"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
    </svg>
  );
}

const SHARE_ICONS = [
  {
    id: "ig",
    label: "Instagram",
    Icon: InstagramMark,
    start: 0.52,
    end: 0.66,
    className: "top-2 left-1",
    rotate: -8,
    origin: "0",
  },
  {
    id: "yt",
    label: "YouTube",
    Icon: YouTubeMark,
    start: 0.66,
    end: 0.8,
    className: "top-1 left-1/2",
    rotate: 4,
    origin: "-50%",
  },
  {
    id: "tt",
    label: "TikTok",
    Icon: TikTokMark,
    start: 0.8,
    end: 0.94,
    className: "top-2 right-1",
    rotate: 9,
    origin: "0",
  },
] as const;

export function StoryUpload({ progress }: { progress: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const from = useElementPercent(rootRef, fromRef);
  const to = useElementPercent(rootRef, toRef);

  const grab = spanProgress(progress, 0.04, 0.12);
  const drag = spanProgress(progress, 0.12, 0.45);
  const drop = spanProgress(progress, 0.45, 0.56);
  const confirm = spanProgress(progress, 0.5, 0.64);
  const travel = Math.max(grab * 0.12, drag);
  const overZone = spanProgress(drag, 0.55, 1);
  const pressed = grab > 0.25 && grab < 1 && drag < 0.08;
  const flying = travel > 0.02 && confirm < 0.92;
  const x = lerp(from.x, to.x, travel);
  const y = lerp(from.y, to.y, travel);

  return (
    <div ref={rootRef} className="relative flex h-full flex-col gap-2 sm:gap-3">
      <PanelHeader
        label="01 / drop it in"
        badge="Upload clip"
        tone="gold"
        badgeTone="teal"
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2 lg:grid-cols-[1fr_2fr] lg:grid-rows-none lg:gap-3">
        <div className="flex min-h-0 flex-col rounded-[16px] border border-[#F5F9CE]/25 bg-[#BC2D29] p-2 shadow-[6px_6px_0_rgba(69,14,22,.75)] sm:p-2.5">
          <div className="ember-mono mb-1.5 flex shrink-0 items-center justify-between text-[9px] tracking-[.13em] text-[#F5F9CE]/65 uppercase">
            <span>Finder</span>
            <span>01 file</span>
          </div>
          <div
            ref={fromRef}
            className="flex min-h-0 flex-1 items-center justify-center"
            style={{ opacity: flying ? 0.28 : 1 - confirm * 0.35 }}
          >
            <RawClip className="h-full max-h-[88px] w-auto max-w-full lg:max-h-[210px]" />
          </div>
        </div>

        <div
          ref={toRef}
          className="relative flex min-h-0 items-center justify-center rounded-[16px] border-2 border-dashed"
          style={{
            borderColor: `color-mix(in srgb, #2DD4BF ${30 + overZone * 50 + confirm * 20}%, transparent)`,
            background: `rgb(45 212 191 / ${0.06 + overZone * 0.08 + confirm * 0.06})`,
          }}
        >
          <div
            className="grid size-10 place-items-center rounded-full border border-[#2DD4BF] text-[#2DD4BF] sm:size-12"
            style={{ opacity: 1 - confirm }}
          >
            <Upload className="size-5" />
          </div>
          <div
            className="absolute top-1/2 left-1/2 grid size-12 place-items-center rounded-full bg-[#2DD4BF] text-[#450E16] shadow-[0_0_0_8px_rgb(45_212_191/0.22)] sm:size-14"
            style={{
              opacity: confirm,
              transform: `translate(-50%, -50%) scale(${0.4 + confirm * 0.6})`,
            }}
          >
            <Check className="size-7" />
          </div>
        </div>
      </div>

      {flying ? (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            opacity: 1 - confirm,
            transform: `translate(-50%, -50%) scale(${pressed ? 0.96 : 1})`,
          }}
        >
          <RawClip className="w-[52px] shadow-[5px_6px_0_rgba(69,14,22,.75)] lg:w-[76px]" />
        </div>
      ) : null}

      <StoryCursor
        x={x}
        y={y}
        pressed={pressed || (drop > 0 && drop < 0.55)}
        visible={confirm < 0.85}
      />
    </div>
  );
}

export function StoryTranscript({ progress }: { progress: number }) {
  return (
    <div className="flex h-full flex-col gap-4">
      <PanelHeader label="02 / let it read" badge="AI Edits" tone="teal" />
      <div className="flex min-h-0 flex-1 items-center">
        <TranscriptCard
          progress={progress}
          zoomAlready={markAmount(progress, "zoom")}
          zoomThere={0}
          animateWords
        />
      </div>
      <PanelFooter>speech becomes a surface you can edit</PanelFooter>
    </div>
  );
}

export function StoryEdit({ progress }: { progress: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const alreadyRef = useRef<HTMLSpanElement>(null);
  const thereRef = useRef<HTMLSpanElement>(null);
  const already = useElementPercent(rootRef, alreadyRef);
  const there = useElementPercent(rootRef, thereRef);

  const toAlready = spanProgress(progress, 0.16, 0.34);
  const clickAlready = spanProgress(progress, 0.34, 0.48);
  const removeZoom = spanProgress(progress, 0.4, 0.54);
  const toThere = spanProgress(progress, 0.56, 0.74);
  const clickThere = spanProgress(progress, 0.74, 0.86);
  const addThere = spanProgress(progress, 0.8, 0.94);

  const x =
    toThere > 0
      ? lerp(already.x, there.x, toThere)
      : lerp(already.x - 10, already.x, toAlready);
  const y =
    toThere > 0
      ? lerp(already.y, there.y, toThere)
      : lerp(already.y - 6, already.y, toAlready);

  return (
    <div ref={rootRef} className="relative flex h-full flex-col gap-3 sm:gap-4">
      <PanelHeader label="03 / make it yours" badge="your call" tone="orange" />
      <div className="flex min-h-0 flex-1 items-center">
        <TranscriptCard
          progress={1}
          zoomAlready={1 - removeZoom}
          zoomThere={addThere}
          animateWords={false}
          wordRefs={{ already: alreadyRef, "there.": thereRef }}
        />
      </div>
      <PanelFooter>choose the treatment. keep the say.</PanelFooter>
      <StoryCursor
        x={x}
        y={y}
        pressed={
          (clickAlready > 0.15 && clickAlready < 0.85) ||
          (clickThere > 0.15 && clickThere < 0.85)
        }
      />
    </div>
  );
}

export function StoryShare({ progress }: { progress: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);
  const video = useElementPercent(rootRef, videoRef);
  const share = useElementPercent(rootRef, shareRef);

  const move = spanProgress(progress, 0.1, 0.34);
  const click = spanProgress(progress, 0.34, 0.48);

  return (
    <div ref={rootRef} className="relative flex h-full flex-col gap-2 sm:gap-4">
      <PanelHeader label="04 / share it" badge="go viral" tone="purple" />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="flex max-h-full flex-col items-center justify-center gap-2 sm:flex-row sm:gap-6">
          <div
            ref={videoRef}
            className="relative w-[84px] shrink-0 rotate-[-3deg] rounded-[18px] border-2 border-[#FFA102] bg-[#BC2D29] p-1.5 shadow-[6px_7px_0_rgba(69,14,22,.76)] sm:w-[140px]"
          >
            <div className="relative aspect-9/16 overflow-hidden rounded-[12px] bg-[#432E6F]">
              <video
                aria-hidden
                autoPlay
                className="h-full w-full object-cover"
                loop
                muted
                playsInline
                src={EDITED_CLIP_SRC}
              />
              {SHARE_ICONS.map((platform) => {
                const amount = spanProgress(
                  progress,
                  platform.start,
                  platform.end,
                );
                return (
                  <span
                    key={platform.id}
                    aria-label={platform.label}
                    className={cn(
                      "absolute z-10 grid size-7 place-items-center rounded-[10px] border border-[#450E16]/15 bg-white shadow-[3px_4px_0_rgba(69,14,22,.45)] sm:size-10",
                      platform.className,
                    )}
                    style={{
                      opacity: amount,
                      transform: `translateX(${platform.origin}) rotate(${platform.rotate}deg) scale(${0.55 + amount * 0.45})`,
                    }}
                  >
                    <platform.Icon className="size-4 sm:size-6" />
                  </span>
                );
              })}
            </div>
          </div>
          <div className="w-fit shrink-0 rounded-[16px] border-2 border-[#450E16] bg-[#F5F9CE] px-3 py-2 text-[#450E16] shadow-[6px_7px_0_rgba(0,0,0,.18)] sm:px-4 sm:py-4">
            <p className="ember-mono m-0 text-[9px] tracking-[.15em] text-[#432E6F] uppercase">
              share your short
            </p>
            <span ref={shareRef} className="mt-2 inline-flex sm:mt-4">
              <Button
                variant="ember"
                size="lg"
                className="h-auto px-4 py-2 sm:py-2.5"
                style={{
                  transform: `scale(${click > 0.2 && click < 0.7 ? 0.94 : 1})`,
                }}
              >
                <Share2 data-icon="inline-start" className="size-4" />
                Share short
              </Button>
            </span>
          </div>
        </div>
      </div>
      <PanelFooter>captions on · 9:16 · ready to share</PanelFooter>
      <StoryCursor
        x={lerp(video.x, share.x, move)}
        y={lerp(video.y, share.y, move)}
        pressed={click > 0.2 && click < 0.85}
        visible={click < 0.95}
      />
    </div>
  );
}
