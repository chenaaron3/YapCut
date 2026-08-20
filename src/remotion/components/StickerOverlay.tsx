import { Lottie, getLottieMetadata } from "@remotion/lottie";
import { useEffect, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { STICKER_BOX_PX, stickerEntry } from "~/domain/edit/sticker";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import { useReportOverlayMeasure } from "~/remotion/hooks/use-report-overlay-measure";

import type { LottieAnimationData } from "@remotion/lottie";
import type { StickerClipProp } from "~/remotion/helpers/types";

/** Enter/exit pop window. Compressed when the clip is shorter. */
const POP_SEC = 0.16;

function stickerPopMotion(
  frame: number,
  duration: number,
  fps: number,
): { opacity: number; scale: number } {
  if (duration <= 1) return { opacity: 1, scale: 1 };
  const authored = Math.max(2, Math.round(POP_SEC * fps));
  const enter = Math.min(authored, Math.max(1, Math.floor(duration / 2)));
  const exitStart = duration - enter;
  const clamp = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };

  const enterScale =
    frame < enter
      ? interpolate(frame, [0, enter * 0.55, enter], [0.55, 1.18, 1], clamp)
      : 1;
  const enterOpacity =
    frame < enter ? interpolate(frame, [0, enter * 0.45], [0, 1], clamp) : 1;
  const exitT =
    frame >= exitStart
      ? interpolate(frame, [exitStart, duration], [0, 1], clamp)
      : 0;

  return {
    opacity: enterOpacity * (1 - exitT),
    scale: enterScale * (1 - 0.3 * exitT),
  };
}

const lottieCache = new Map<string, Promise<LottieAnimationData>>();

function loadLottie(src: string): Promise<LottieAnimationData> {
  const hit = lottieCache.get(src);
  if (hit) return hit;
  const pending = fetch(src).then(async (res) => {
    if (!res.ok) throw new Error(`Lottie fetch failed: ${src} (${res.status})`);
    return (await res.json()) as LottieAnimationData;
  });
  lottieCache.set(src, pending);
  return pending;
}

function useLottieData(src: string): LottieAnimationData | null {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`sticker-lottie:${src}`));

  useEffect(() => {
    let cancelled = false;
    loadLottie(src)
      .then((json) => {
        if (!cancelled) setData(json);
        continueRender(handle);
      })
      .catch((err) => {
        cancelRender(err);
      });
    return () => {
      cancelled = true;
    };
  }, [src, handle]);

  return data;
}

function lottiePlaybackRate(
  data: LottieAnimationData,
  compositionFps: number,
): number {
  if (data.fr <= 0 || compositionFps <= 0) return 1;
  return data.fr / compositionFps;
}

/** Authored speed, or faster so one cycle finishes on the last clip frame. */
function clipFitPlaybackRate(
  data: LottieAnimationData,
  compositionFps: number,
  clipFrames: number,
): number {
  const authored = lottiePlaybackRate(data, compositionFps);
  const lastLocal = Math.max(1, clipFrames) - 1;
  if (lastLocal <= 0) return authored;
  const meta = getLottieMetadata(data);
  const total = Math.max(1, meta?.durationInFrames ?? Math.floor(data.op));
  return Math.max(authored, (total - 1) / lastLocal);
}

function CatalogLottie({
  src,
  loop,
  durationInFrames,
}: {
  src: string;
  loop: boolean;
  durationInFrames: number;
}) {
  const data = useLottieData(src);
  const { fps } = useVideoConfig();
  if (!data) return null;
  return (
    <Lottie
      animationData={data}
      loop={loop}
      playbackRate={clipFitPlaybackRate(data, fps, durationInFrames)}
      style={{ width: STICKER_BOX_PX, height: STICKER_BOX_PX }}
    />
  );
}

function StickerItem({ clip }: { clip: StickerClipProp }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = stickerEntry(clip.source, clip.catalogId);
  const boxRef = useReportOverlayMeasure(
    clip.id,
    true,
    `${clip.source}:${clip.catalogId}`,
  );
  const pose = `translate(${clip.offsetX * COMPOSITION_WIDTH}px, ${clip.offsetY * COMPOSITION_HEIGHT}px) rotate(${clip.rotation}deg) scale(${clip.scale})`;

  if (!entry) return null;

  const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
  const pop = stickerPopMotion(frame, durationInFrames, fps);
  const src = staticFile(entry.file);
  const paint = (
    <CatalogLottie
      src={src}
      loop={entry.playback === "loop"}
      durationInFrames={durationInFrames}
    />
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        ref={boxRef}
        style={{
          position: "relative",
          width: STICKER_BOX_PX,
          height: STICKER_BOX_PX,
          transform: pose,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: pop.opacity,
            transform: `scale(${pop.scale})`,
            transformOrigin: "center center",
          }}
        >
          {paint}
        </div>
      </div>
    </div>
  );
}

export function StickerOverlay({ stickers }: { stickers: StickerClipProp[] }) {
  return (
    <>
      {stickers.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <StickerItem clip={clip} />
          </Sequence>
        );
      })}
    </>
  );
}
