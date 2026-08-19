import { AssetCallout } from "~/remotion/components/motion/AssetCallout";
import { Checklist } from "~/remotion/components/motion/Checklist";
import { DataChart } from "~/remotion/components/motion/DataChart";
import { LowerThird } from "~/remotion/components/motion/LowerThird";
import { NewsEmphasis } from "~/remotion/components/motion/NewsEmphasis";
import { StatCount } from "~/remotion/components/motion/StatCount";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import { useReportOverlayMeasure } from "~/remotion/hooks/use-report-overlay-measure";

import type { ReactNode } from "react";
import type { MotionOverlayProp } from "~/remotion/helpers/types";

function paintPlan(
  overlay: MotionOverlayProp,
  localSec: number,
  durationSec: number,
): ReactNode {
  const { plan, style } = overlay;
  const clock = { localSec, durationSec };
  switch (plan.category) {
    case "stat":
      return <StatCount content={plan.content} style={style} {...clock} />;
    case "charts":
      return <DataChart content={plan.content} style={style} {...clock} />;
    case "lower-thirds":
      return <LowerThird content={plan.content} style={style} {...clock} />;
    case "news":
      return <NewsEmphasis content={plan.content} style={style} {...clock} />;
    case "asset-fusion":
      return (
        <AssetCallout
          content={plan.content}
          style={style}
          src={overlay.media?.src ?? null}
          width={overlay.media?.width ?? null}
          height={overlay.media?.height ?? null}
          {...clock}
        />
      );
    case "checklist":
      return <Checklist content={plan.content} style={style} {...clock} />;
  }
}

export function MotionGraphic({
  overlay,
  frame,
  fps,
  measure = false,
}: {
  overlay: MotionOverlayProp;
  frame: number;
  fps: number;
  measure?: boolean;
}) {
  const localSec = (frame - overlay.startFrame) / fps;
  const durationSec = Math.max(
    1 / fps,
    (overlay.endFrame - overlay.startFrame) / fps,
  );
  const plan = overlay.plan;
  const boxRef = useReportOverlayMeasure(
    overlay.id,
    measure,
    `${plan.category}\0${overlay.startFrame}`,
  );

  // Lower-thirds place themselves in composition space; other catalogs are
  // centered cards that take the Edit Transform.
  const fillFrame = plan.category === "lower-thirds";
  const pose = fillFrame
    ? undefined
    : `translate(${overlay.offsetX * COMPOSITION_WIDTH}px, ${overlay.offsetY * COMPOSITION_HEIGHT}px) rotate(${overlay.rotation}deg) scale(${overlay.scale})`;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: fillFrame ? "block" : "flex",
        alignItems: fillFrame ? undefined : "center",
        justifyContent: fillFrame ? undefined : "center",
        pointerEvents: "none",
      }}
    >
      <div
        ref={boxRef}
        style={{
          position: fillFrame ? "absolute" : "relative",
          inset: fillFrame ? 0 : undefined,
          transform: pose,
          transformOrigin: "center center",
        }}
      >
        {paintPlan(overlay, localSec, durationSec)}
      </div>
    </div>
  );
}
