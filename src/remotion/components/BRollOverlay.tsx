import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";

import { containSize } from "~/domain/transform";
import type { BrollClipProp } from "~/remotion/types";

const FADE_SEC = 0.12;
const KEN_BURNS_EASING = Easing.inOut(Easing.ease);

function scaleAtFrame(
  frame: number,
  duration: number,
  startScale: number,
  kenBurns: number | undefined,
): number {
  if (kenBurns == null) return startScale;
  const endScale = startScale * kenBurns;
  if (duration <= 1) return endScale;
  return interpolate(frame, [0, duration - 1], [startScale, endScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: KEN_BURNS_EASING,
  });
}

function Clip({ clip }: { clip: BrollClipProp }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const duration = Math.max(1, clip.endFrame - clip.startFrame);
  const fade = Math.max(1, Math.round(FADE_SEC * fps));
  const opacity =
    duration <= fade * 2
      ? 1
      : interpolate(
          frame,
          [0, fade, duration - fade, duration],
          [1, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  const scale = scaleAtFrame(frame, duration, clip.scale, clip.kenBurns);
  const { offsetX, offsetY, rotation, volume, mediaOffsetSec } = clip;
  const trimBefore = Math.round(mediaOffsetSec * fps);
  const fitted = containSize(clip.width, clip.height, width, height);
  const mediaStyle: CSSProperties = {
    display: "block",
    width: fitted.w,
    height: fitted.h,
    objectFit: "fill",
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "relative",
          width: fitted.w,
          height: fitted.h,
          transform: `translate(${offsetX * width}px, ${offsetY * height}px) rotate(${rotation}deg) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {clip.mediaKind === "video" ? (
          <Video
            src={clip.src}
            trimBefore={trimBefore}
            volume={volume}
            muted={volume <= 0}
            objectFit="fill"
            style={mediaStyle}
          />
        ) : (
          <Img src={clip.src} style={mediaStyle} />
        )}
      </div>
    </AbsoluteFill>
  );
}

export function BRollOverlay({
  brolls,
}: {
  brolls?: BrollClipProp[] | null;
}) {
  if (!brolls?.length) return null;

  return (
    <>
      {brolls.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={durationInFrames}
          >
            <Clip clip={clip} />
          </Sequence>
        );
      })}
    </>
  );
}
