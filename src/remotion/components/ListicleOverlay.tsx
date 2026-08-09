import { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { buildStaticGroup } from "~/remotion/components/captions/static-group";
import { StaticGroupView } from "~/remotion/components/captions/StaticGroupView";
import { SAFE_AREA } from "~/remotion/constants";

import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { ListicleOverlayProp } from "~/remotion/types";

const STACK_GAP_PX = 10;

type PhaseTiming = { start: number; duration: number };

/** Frame timings for indicator/value from stacked + staggered flags. */
export function listiclePhaseTimings(
  start: number,
  end: number,
  middle: number | null,
  stacked: boolean,
): { indicator: PhaseTiming; value: PhaseTiming } {
  const staggered = middle != null;
  const mid = staggered ? Math.max(start, Math.min(middle, end)) : start;

  if (staggered && stacked) {
    return {
      indicator: { start, duration: end - start },
      value: { start: mid, duration: end - mid },
    };
  }
  if (!staggered && !stacked) {
    return {
      indicator: { start, duration: 0 },
      value: { start, duration: end - start },
    };
  }
  if (staggered && !stacked) {
    return {
      indicator: { start, duration: mid - start },
      value: { start: mid, duration: end - mid },
    };
  }
  // !staggered && stacked
  return {
    indicator: { start, duration: end - start },
    value: { start, duration: end - start },
  };
}

function phaseActive(
  absoluteFrame: number,
  timing: PhaseTiming,
  text: string,
): boolean {
  return (
    timing.duration > 0 &&
    text.trim().length > 0 &&
    absoluteFrame >= timing.start &&
    absoluteFrame < timing.start + timing.duration
  );
}

function ListicleText({
  text,
  style,
  durationFrames,
  frame,
  fps,
  embedded,
}: {
  text: string;
  style: CaptionGroupStyle;
  durationFrames: number;
  frame: number;
  fps: number;
  embedded: boolean;
}) {
  const group = useMemo(
    () => buildStaticGroup(text, style, fps, durationFrames),
    [text, style, fps, durationFrames],
  );

  if (!text.trim() || frame < 0 || frame >= durationFrames) return null;

  return (
    <StaticGroupView
      group={group}
      frame={frame}
      fps={fps}
      embedded={embedded}
    />
  );
}

function ListiclePair({
  overlay,
  timings,
}: {
  overlay: ListicleOverlayProp;
  timings: { indicator: PhaseTiming; value: PhaseTiming };
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteFrame = overlay.startFrame + frame;

  const showIndicator = phaseActive(
    absoluteFrame,
    timings.indicator,
    overlay.indicatorText,
  );
  const showValue = phaseActive(
    absoluteFrame,
    timings.value,
    overlay.valueText,
  );

  if (!showIndicator && !showValue) return null;

  const indicator = showIndicator ? (
    <ListicleText
      text={overlay.indicatorText}
      style={overlay.indicatorStyle}
      durationFrames={Math.max(1, timings.indicator.duration)}
      frame={absoluteFrame - timings.indicator.start}
      fps={fps}
      embedded={overlay.stacked}
    />
  ) : null;

  const value = showValue ? (
    <ListicleText
      text={overlay.valueText}
      style={overlay.valueStyle}
      durationFrames={Math.max(1, timings.value.duration)}
      frame={absoluteFrame - timings.value.start}
      fps={fps}
      embedded={overlay.stacked}
    />
  ) : null;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        top: SAFE_AREA.top,
        bottom: SAFE_AREA.bottom,
        left: SAFE_AREA.left,
        right: SAFE_AREA.right,
        width: "auto",
        height: "auto",
      }}
    >
      {overlay.stacked ? (
        <div
          style={{
            position: "absolute",
            top: `${overlay.valueStyle.y * 100}%`,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: STACK_GAP_PX,
            transform: "translateY(-50%)",
          }}
        >
          {indicator}
          {value}
        </div>
      ) : (
        <>
          {indicator}
          {value}
        </>
      )}
    </AbsoluteFill>
  );
}

function ListicleItem({ overlay }: { overlay: ListicleOverlayProp }) {
  const fullDuration = Math.max(1, overlay.endFrame - overlay.startFrame);
  const timings = listiclePhaseTimings(
    overlay.startFrame,
    overlay.endFrame,
    overlay.middleFrame,
    overlay.stacked,
  );

  return (
    <Sequence
      from={overlay.startFrame}
      durationInFrames={fullDuration}
      layout="none"
    >
      <ListiclePair overlay={overlay} timings={timings} />
    </Sequence>
  );
}

/** Indicator + value for listicle VFX edits. */
export function ListicleOverlay({
  overlays,
}: {
  overlays: ListicleOverlayProp[];
}) {
  return (
    <>
      {overlays.map((overlay) => (
        <ListicleItem key={overlay.id} overlay={overlay} />
      ))}
    </>
  );
}
