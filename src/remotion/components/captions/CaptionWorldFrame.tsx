import { AbsoluteFill } from "remotion";

import { captionSafeAreaT } from "~/remotion/captions/style";
import { SAFE_AREA } from "~/remotion/helpers/constants";
import { useReportCaptionMeasure } from "~/remotion/hooks/use-report-caption-measure";

import type { ReactNode } from "react";

/** Safe-area world for captions/quotes. `y` is −1…1; Composite does not see it. */
export function CaptionWorldFrame({
  y,
  measure = false,
  layoutKey,
  children,
}: {
  y: number;
  measure?: boolean;
  layoutKey: unknown;
  children: ReactNode;
}) {
  const shellRef = useReportCaptionMeasure(measure, layoutKey);
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
      <div
        ref={measure ? shellRef : undefined}
        style={{
          position: "absolute",
          top: `${captionSafeAreaT(y) * 100}%`,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: "translateY(-50%)",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}
