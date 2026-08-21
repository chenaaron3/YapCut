import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import {
  zoomLayerCssPx,
  zoomTransformAtFrame,
} from "~/remotion/helpers/zoom-transform";

import type { ZoomProp } from "~/remotion/helpers/types";
import type { ReactNode } from "react";

export function Zoom({
  zooms,
  children,
}: {
  zooms: ZoomProp[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = zoomTransformAtFrame(frame, zooms);

  return (
    <AbsoluteFill style={zoomLayerCssPx(t, width, height)}>
      {children}
    </AbsoluteFill>
  );
}
