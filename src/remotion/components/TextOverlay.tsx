import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import { buildStaticGroup } from "~/remotion/components/captions/static-group";
import {
  STACK_GAP_PX,
  StackedCaptionPair,
} from "~/remotion/components/captions/StackedCaptionPair";
import { StaticGroupView } from "~/remotion/components/captions/StaticGroupView";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import type { TextOverlayProp } from "~/remotion/helpers/types";
import { useReportOverlayMeasure } from "~/remotion/hooks/use-report-overlay-measure";

import type { CaptionGroupStyle } from "~/remotion/captions/style";

type PhaseTiming = { start: number; duration: number };

/** Frame timings for heading/subheading. `middle` null = both from start. */
export function overlayPhaseTimings(
  start: number,
  end: number,
  middle: number | null,
  stacked: boolean,
): { heading: PhaseTiming; subheading: PhaseTiming } {
  const full = { start, duration: end - start };
  if (middle == null) {
    return { heading: full, subheading: full };
  }
  const mid = Math.max(start, Math.min(middle, end));
  const fromMid = { start: mid, duration: end - mid };
  if (stacked) {
    return { heading: full, subheading: fromMid };
  }
  return {
    heading: { start, duration: mid - start },
    subheading: fromMid,
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

function OverlayLine({
  text,
  style,
  durationFrames,
  frame,
  fps,
  visible,
}: {
  text: string;
  style: CaptionGroupStyle;
  durationFrames: number;
  frame: number;
  fps: number;
  visible: boolean;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  const group = useMemo(
    () => buildStaticGroup(text, style, fps, durationFrames),
    [text, style, fps, durationFrames],
  );

  useLayoutEffect(() => {
    const node = lineRef.current;
    if (!node) return;
    const update = () => setLineHeight(node.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [text, style.fontSize, style.background, style.y]);

  if (!text.trim()) return null;

  const paintFrame = Math.max(0, Math.min(frame, durationFrames - 1));
  // Layout margin (not transform): closes stack gap, updates AABB, enables overlap.
  const yShift = style.y * lineHeight;

  return (
    <div
      ref={lineRef}
      style={{
        visibility: visible ? "visible" : "hidden",
        marginTop: yShift,
      }}
    >
      <StaticGroupView
        group={group}
        frame={paintFrame}
        fps={fps}
        embedded
      />
    </div>
  );
}

function OverlayPair({
  stacked,
  heading,
  subheading,
}: {
  stacked: boolean;
  heading: ReactNode;
  subheading: ReactNode;
}) {
  if (!heading) return <>{subheading}</>;
  if (!subheading) return <>{heading}</>;
  if (stacked) {
    return (
      <StackedCaptionPair gap={STACK_GAP_PX}>
        {heading}
        {subheading}
      </StackedCaptionPair>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        alignItems: "center",
      }}
    >
      {/* Subheading first so heading paints on top in the shared cell. */}
      <div style={{ gridArea: "1 / 1", position: "relative", zIndex: 0 }}>
        {subheading}
      </div>
      <div style={{ gridArea: "1 / 1", position: "relative", zIndex: 1 }}>
        {heading}
      </div>
    </div>
  );
}

/**
 * Remotion-free overlay paint — shared by {@link TextOverlay} and the
 * inspector template preview.
 */
export function TextOverlayView({
  overlay,
  frame,
  fps,
  measure = false,
}: {
  overlay: TextOverlayProp;
  /** Absolute composition frame. */
  frame: number;
  fps: number;
  /** Report painted AABB for the player transform box. */
  measure?: boolean;
}) {
  const headingText = overlay.heading.trim();
  const subText = overlay.subheading.trim();
  const stackedLayout = overlay.stacked && Boolean(headingText && subText);
  const boxRef = useReportOverlayMeasure(
    overlay.id,
    measure,
    `${headingText}\0${subText}\0${stackedLayout}\0${overlay.headingStyle.y}\0${overlay.subheadingStyle.y}`,
  );
  const timings = overlayPhaseTimings(
    overlay.startFrame,
    overlay.endFrame,
    overlay.middleFrame,
    stackedLayout,
  );

  const showHeading = phaseActive(frame, timings.heading, headingText);
  const showSub = phaseActive(frame, timings.subheading, subText);

  if (!headingText && !subText) return null;

  const headingLayer = headingText ? (
    <OverlayLine
      text={headingText}
      style={overlay.headingStyle}
      durationFrames={Math.max(1, timings.heading.duration)}
      frame={frame - timings.heading.start}
      fps={fps}
      visible={showHeading}
    />
  ) : null;

  const subLayer = subText ? (
    <OverlayLine
      text={subText}
      style={overlay.subheadingStyle}
      durationFrames={Math.max(1, timings.subheading.duration)}
      frame={frame - timings.subheading.start}
      fps={fps}
      visible={showSub}
    />
  ) : null;

  const { offsetX, offsetY, rotation, scale } = overlay;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translate(${offsetX * COMPOSITION_WIDTH}px, ${offsetY * COMPOSITION_HEIGHT}px) rotate(${rotation}deg) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Measure the untransformed pad box (padding/margins included). */}
        <div
          ref={boxRef}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <OverlayPair
            stacked={stackedLayout}
            heading={headingLayer}
            subheading={subLayer}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function TextOverlayItem({ overlay }: { overlay: TextOverlayProp }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <TextOverlayView
      overlay={overlay}
      frame={overlay.startFrame + frame}
      fps={fps}
      measure
    />
  );
}

export function TextOverlay({ overlays }: { overlays: TextOverlayProp[] }) {
  return (
    <>
      {overlays.map((overlay) => {
        const durationInFrames = Math.max(
          1,
          overlay.endFrame - overlay.startFrame,
        );
        return (
          <Sequence
            key={overlay.id}
            from={overlay.startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <TextOverlayItem overlay={overlay} />
          </Sequence>
        );
      })}
    </>
  );
}
