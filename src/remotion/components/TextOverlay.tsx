import { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { CompositeGroupLayout } from "~/remotion/components/captions/CompositeGroupLayout";
import { buildStaticGroup } from "~/remotion/components/captions/static-group";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import { useReportOverlayMeasure } from "~/remotion/hooks/use-report-overlay-measure";

import type { CompositeItem } from "~/remotion/components/captions/CompositeGroupLayout";
import type { TextOverlayProp } from "~/remotion/helpers/types";

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

function overlayItem(
  text: string,
  style: TextOverlayProp["headingStyle"],
  timing: PhaseTiming,
  frame: number,
  fps: number,
  visible: boolean,
  localY: number,
): CompositeItem | null {
  if (!text.trim() || timing.duration <= 0) return null;
  const durationFrames = Math.max(1, timing.duration);
  const paintFrame = Math.max(
    0,
    Math.min(frame - timing.start, durationFrames - 1),
  );
  return {
    group: buildStaticGroup(text, style, fps, durationFrames),
    localY,
    cycleWordStates: false,
    visible,
    frame: paintFrame,
  };
}

/**
 * Overlay paint shared by export and the inspector preview.
 * World = center + offset/rotate/scale. Lines go through Composite
 * (`stack` or `series`); first line `localY` is always 0.
 */
export function TextOverlayView({
  overlay,
  frame,
  fps,
  measure = false,
}: {
  overlay: TextOverlayProp;
  frame: number;
  fps: number;
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

  const items = useMemo(() => {
    const out: CompositeItem[] = [];
    const heading = overlayItem(
      headingText,
      overlay.headingStyle,
      timings.heading,
      frame,
      fps,
      showHeading,
      0,
    );
    if (heading) out.push(heading);
    const sub = overlayItem(
      subText,
      overlay.subheadingStyle,
      timings.subheading,
      frame,
      fps,
      showSub,
      stackedLayout ? overlay.subheadingStyle.y : 0,
    );
    if (sub) out.push(sub);
    return out;
  }, [
    headingText,
    subText,
    overlay.headingStyle,
    overlay.subheadingStyle,
    timings.heading,
    timings.subheading,
    frame,
    fps,
    showHeading,
    showSub,
    stackedLayout,
  ]);

  if (!headingText && !subText) return null;

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
        <div
          ref={boxRef}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <CompositeGroupLayout
            layout={stackedLayout ? "stack" : "series"}
            items={items}
            fps={fps}
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
