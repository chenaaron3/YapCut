import { AbsoluteFill, useCurrentFrame } from "remotion";

import { SAFE_AREA } from "~/remotion/constants";
import type { TextOverlayProp } from "~/remotion/types";

export function TextOverlay({ overlays }: { overlays: TextOverlayProp[] }) {
  const frame = useCurrentFrame();
  const active = overlays.find(
    (o) => frame >= o.startFrame && frame < o.endFrame,
  );
  if (!active) return null;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        top: SAFE_AREA.top,
        bottom: "auto",
        left: SAFE_AREA.left,
        right: SAFE_AREA.right,
        width: "auto",
        height: "20%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 24,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
          fontWeight: 900,
          fontSize: 56,
          textAlign: "center",
          textTransform: "uppercase",
          textShadow: "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)",
          WebkitTextStroke: "6px #000",
          paintOrder: "stroke fill",
          lineHeight: 1.15,
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
}
