import { Img } from "remotion";

import {
  easeOutCubic,
  playheadSec,
  span,
} from "~/remotion/components/motion/clock";
import { motionLook } from "~/remotion/components/motion/look";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";

import type { AssetFusionContent } from "~/domain/vfx/motion-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

/** HyperFrames asset-fusion still + label. */
const AUTHORED = 3.4;
const FALLBACK_SIZE = { width: 768, height: 1024 };

function paintSize(
  width: number | null | undefined,
  height: number | null | undefined,
): { width: number; height: number } {
  const natW = width && width > 0 ? width : FALLBACK_SIZE.width;
  const natH = height && height > 0 ? height : FALLBACK_SIZE.height;
  const s = Math.min(1, COMPOSITION_WIDTH / natW, COMPOSITION_HEIGHT / natH);
  return {
    width: Math.round(natW * s),
    height: Math.round(natH * s),
  };
}

export function AssetCallout({
  content,
  style,
  src,
  width,
  height,
  localSec,
  durationSec,
}: {
  content: AssetFusionContent;
  style: CaptionGroupStyle;
  src: string | null;
  width: number | null;
  height: number | null;
  localSec: number;
  durationSec: number;
}) {
  const look = motionLook(style);
  const t = playheadSec(localSec, AUTHORED, durationSec);
  const enter = span(t, 0, 0.5, easeOutCubic);
  const labelU = span(t, 1.1, 0.45, easeOutCubic);
  const size = paintSize(width, height);

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        position: "relative",
        overflow: "hidden",
        background: "#111",
        opacity: enter,
      }}
    >
      {src ? (
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "fill" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "#222" }} />
      )}
      <div
        style={{
          position: "absolute",
          left: 28,
          top: 28,
          maxWidth: "72%",
          zIndex: 2,
          ...look.font,
          ...look.paint,
          fontSize: 28,
          fontWeight: 700,
          color: "#fff",
          background: "#111",
          padding: "8px 14px",
          borderRadius: 8,
          opacity: labelU,
          transform: `translateY(${(1 - labelU) * 10}px)`,
        }}
      >
        {content.label}
      </div>
    </div>
  );
}
