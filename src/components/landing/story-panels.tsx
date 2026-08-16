import { Check, Download, Upload, Video } from "lucide-react";

import { StoryCursor } from "~/components/landing/StoryCursor";
import { lerp, spanProgress } from "~/components/landing/use-story-progress";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export const TRANSCRIPT = [
  { word: "The", key: "the" },
  { word: "idea", key: "idea" },
  { word: "is", key: "is" },
  { word: "already", key: "already" },
  { word: "there.", key: "there" },
] as const;

const EDIT_STYLE = {
  Emphasis: "border-[#DD5533] bg-[#DD5533] text-[#F5F9CE]",
  Zoom: "border-[#3B82F6] bg-[#3B82F6] text-[#450E16]",
  SFX: "border-[#2DD4BF] bg-[#2DD4BF] text-[#450E16]",
} as const;

type EditKind = keyof typeof EDIT_STYLE;

function EditChip({ kind, show }: { kind: EditKind; show: number }) {
  return (
    <Badge
      className={cn(
        "ember-mono absolute -top-6 left-1/2 h-auto rounded-[6px] border-2 px-1.5 py-0.5 text-[8px] font-semibold tracking-[.12em] uppercase",
        EDIT_STYLE[kind],
      )}
      style={{
        opacity: show,
        transform: `translateX(-50%) translateY(${(1 - show) * 8}px) scale(${0.75 + show * 0.25})`,
      }}
    >
      {kind}
    </Badge>
  );
}

export function StoryUpload({ progress }: { progress: number }) {
  const click = spanProgress(progress, 0.04, 0.12);
  const drag = spanProgress(progress, 0.12, 0.55);
  const drop = spanProgress(progress, 0.55, 0.7);
  const confirm = spanProgress(progress, 0.68, 0.82);
  const pressed = click > 0.2 && click < 1 && drag < 0.08;

  return (
    <div className="relative h-full min-h-[520px]">
      <p className="ember-mono m-0 text-[10px] tracking-[.18em] text-[#FFA102] uppercase">
        01 / upload
      </p>
      <h3 className="ember-display mt-4 mb-0 max-w-[16ch] text-4xl leading-[.82] sm:text-6xl">
        Drop your Short. <span className="text-[#FFA102]">Keep moving.</span>
      </h3>
      <div className="relative mt-12 grid items-center gap-6 md:grid-cols-[1fr_1fr]">
        <Card
          className="relative z-10 rounded-[16px] border border-[#F5F9CE]/25 bg-[#BC2D29] py-4 ring-0 shadow-[8px_8px_0_rgba(69,14,22,.75)]"
          style={{
            transform: `translate(${drag * 220}px, ${drag * -8}px)`,
            opacity: 1 - drop * 0.25,
          }}
        >
          <CardHeader className="ember-mono flex-row items-center justify-between pb-0 text-[9px] tracking-[.13em] text-[#F5F9CE]/65 uppercase">
            <span>Finder</span>
            <span>short_014.mp4</span>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#F5F9CE]/20 bg-[#450E16] p-3">
              <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#FFA102] text-[#450E16]">
                <Video className="size-[18px]" />
              </span>
              <span>
                <strong className="block text-base">short_014.mp4</strong>
                <small className="ember-mono text-[9px] text-[#F5F9CE]/55">
                  1080 × 1920 · 00:28
                </small>
              </span>
            </div>
          </CardContent>
        </Card>
        <div className="relative rounded-[16px] border-2 border-dashed border-[#2DD4BF] bg-[#2DD4BF]/10 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#2DD4BF] text-[#2DD4BF]">
            <Upload className="size-[23px]" />
          </div>
          <h4 className="mt-5 text-2xl font-semibold">Drop surface</h4>
          <p className="mt-2 text-base text-[#F5F9CE]/60">9:16 talking-head Shorts.</p>
          <div
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-[#2DD4BF] text-[#450E16]"
            style={{
            opacity: confirm,
            transform: `scale(${0.5 + confirm * 0.5})`,
            visibility: confirm > 0.04 ? "visible" : "hidden",
            }}
          >
            <Check className="size-[17px]" />
          </div>
        </div>
      </div>
      <StoryCursor
        x={lerp(18, 72, drag)}
        y={lerp(58, 48, drag)}
        pressed={pressed || (drop > 0 && drop < 0.5)}
      />
    </div>
  );
}

export function StoryTranscript({ progress }: { progress: number }) {
  return (
    <div className="relative h-full min-h-[520px]">
      <p className="ember-mono m-0 text-[10px] tracking-[.18em] text-[#2DD4BF] uppercase">
        02 / first pass
      </p>
      <h3 className="ember-display mt-4 mb-0 max-w-[16ch] text-4xl leading-[.82] sm:text-6xl">
        Let the words <span className="text-[#2DD4BF]">show up.</span>
      </h3>
      <TranscriptStage progress={progress} mode="reveal" />
    </div>
  );
}

export function StoryEdit({ progress }: { progress: number }) {
  const move1 = spanProgress(progress, 0.08, 0.28);
  const click1 = spanProgress(progress, 0.28, 0.38);
  const change = spanProgress(progress, 0.38, 0.52);
  const move2 = spanProgress(progress, 0.55, 0.75);
  const add = spanProgress(progress, 0.75, 0.9);
  const pressed = (click1 > 0.15 && click1 < 0.85) || (add > 0.1 && add < 0.55);

  const x =
    move2 > 0
      ? lerp(38, 14, move2)
      : lerp(12, 38, move1);
  const y =
    move2 > 0
      ? lerp(62, 62, move2)
      : lerp(48, 62, move1);

  return (
    <div className="relative h-full min-h-[520px]">
      <p className="ember-mono m-0 text-[10px] tracking-[.18em] text-[#FFA102] uppercase">
        03 / edit
      </p>
      <h3 className="ember-display mt-4 mb-0 max-w-[16ch] text-4xl leading-[.82] sm:text-6xl">
        Make the pass <span className="text-[#FFA102]">your own.</span>
      </h3>
      <TranscriptStage
        progress={1}
        mode="edit"
        ideaKind={change > 0.5 ? "Zoom" : "Emphasis"}
        theSfx={add}
        menu={click1 > 0.4 && change < 0.85}
      />
      <StoryCursor x={x} y={y} pressed={pressed} />
    </div>
  );
}

export function StoryExport({ progress }: { progress: number }) {
  const move = spanProgress(progress, 0.1, 0.45);
  const click = spanProgress(progress, 0.45, 0.58);
  const done = spanProgress(progress, 0.58, 0.78);

  return (
    <div className="relative h-full min-h-[520px]">
      <p className="ember-mono m-0 text-[10px] tracking-[.18em] text-[#FFA102] uppercase">
        04 / export
      </p>
      <h3 className="ember-display mt-4 mb-0 max-w-[16ch] text-4xl leading-[.82] sm:text-6xl">
        Click export. <span className="text-[#FFA102]">Post the Short.</span>
      </h3>
      <div className="mt-14 max-w-md rounded-[16px] border border-[#F5F9CE]/20 bg-[#BC2D29] p-6">
        <p className="ember-mono m-0 text-[9px] tracking-[.15em] text-[#F5F9CE]/55 uppercase">
          final render · 9:16
        </p>
        <h4 className="mt-4 mb-0 text-3xl font-semibold">The cut is yours.</h4>
        <Button
          variant="ember"
          size="lg"
          className="relative mt-7 h-auto px-5 py-3 shadow-[5px_6px_0_#450E16]"
          style={{ transform: `scale(${click > 0.2 && click < 0.7 ? 0.94 : 1})` }}
        >
          <Download data-icon="inline-start" className="size-4" />
          Export 1080 × 1920
        </Button>
        <Badge
          variant="outline"
          className="mt-4 h-auto rounded-[8px] border-[#2DD4BF] bg-[#2DD4BF]/15 px-3 py-2 text-[9px] tracking-[.12em] text-[#9DEEE1] uppercase"
          style={{ opacity: done, transform: `translateY(${(1 - done) * 8}px)` }}
        >
          <Check className="size-[13px]" />
          short_014.mp4 downloading
        </Badge>
        <div
          className="pointer-events-none absolute right-[18%] top-[58%] z-30 flex items-center gap-2 rounded-[10px] border-2 border-[#450E16] bg-[#F5F9CE] px-3 py-2 text-[#450E16] shadow-[5px_5px_0_#450E16]"
          style={{
            opacity: done,
            transform: `translateY(${done * 48}px) scale(${0.85 + done * 0.15})`,
          }}
        >
          <Video className="size-4" />
          <span className="ember-mono text-[9px] font-semibold tracking-[.12em] uppercase">
            short_014.mp4
          </span>
        </div>
      </div>
      <StoryCursor
        x={lerp(22, 36, move)}
        y={lerp(40, 68, move)}
        pressed={click > 0.2 && click < 0.85}
      />
    </div>
  );
}

function TranscriptStage({
  progress,
  mode,
  ideaKind = "Emphasis",
  theSfx = 0,
  menu = false,
}: {
  progress: number;
  mode: "reveal" | "edit";
  ideaKind?: EditKind;
  theSfx?: number;
  menu?: boolean;
}) {
  const wordCount = TRANSCRIPT.length;
  return (
    <Card className="relative mt-12 rounded-[16px] border border-[#F5F9CE]/20 bg-[#BC2D29] py-5 ring-0 text-[#F5F9CE] sm:py-8">
      <CardHeader className="ember-mono flex-row items-center justify-between pb-0 text-[9px] tracking-[.14em] text-[#F5F9CE]/55 uppercase">
        <span>words / 00:08</span>
        <span className="text-[#2DD4BF]">talking-head Short</span>
      </CardHeader>
      <CardContent>
      <p className="mt-8 mb-0 flex flex-wrap gap-x-3 gap-y-6 text-[clamp(1.6rem,3.6vw,3.1rem)] leading-[1.05]">
        {TRANSCRIPT.map((item, i) => {
          const appear =
            mode === "edit"
              ? 1
              : spanProgress(
                  progress,
                  (i / wordCount) * 0.48,
                  ((i + 1) / wordCount) * 0.48 + 0.04,
                );
          const highlightStart = 0.52 + i * 0.08;
          const highlight =
            mode === "edit"
              ? 1
              : spanProgress(progress, highlightStart, highlightStart + 0.12);
          const chip =
            item.key === "idea"
              ? { kind: ideaKind, show: highlight }
              : item.key === "already"
                ? { kind: "Zoom" as const, show: highlight }
                : item.key === "there"
                  ? { kind: "SFX" as const, show: highlight }
                  : item.key === "the"
                    ? { kind: "SFX" as const, show: theSfx }
                    : null;
          return (
            <span key={item.key} className="relative inline-block">
              {chip && chip.show > 0.02 ? (
                <EditChip kind={chip.kind} show={chip.show} />
              ) : null}
              <span
                className={cn(
                  "inline-block rounded-[6px] px-1 transition-colors",
                  chip && chip.show > 0.4 ? "bg-[#F5F9CE] text-[#450E16]" : undefined,
                )}
                style={{
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 14}px)`,
                }}
              >
                {item.word}
              </span>
              {item.key === "idea" && menu ? (
                <span className="absolute top-full left-0 z-20 mt-2 w-28 rounded-[10px] border-2 border-[#450E16] bg-[#F5F9CE] p-1 text-[#450E16] shadow-[4px_4px_0_#450E16]">
                  <span className="ember-mono block px-2 py-1 text-[8px] tracking-[.12em] text-[#75677F] uppercase">
                    Change
                  </span>
                  <span className="block rounded-[6px] px-2 py-1 text-sm">Emphasis</span>
                  <span className="block rounded-[6px] bg-[#FFA102] px-2 py-1 text-sm font-semibold">
                    Zoom
                  </span>
                  <span className="block rounded-[6px] px-2 py-1 text-sm">SFX</span>
                </span>
              ) : null}
            </span>
          );
        })}
      </p>
      </CardContent>
    </Card>
  );
}
