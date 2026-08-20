import {
  easeOutCubic,
  playheadSec,
  span,
} from "~/remotion/components/motion/clock";
import { motionLook, type MotionLook } from "~/remotion/components/motion/look";

import type { CSSProperties } from "react";
import type { LowerThirdsContent } from "~/domain/vfx/motion-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

/** HyperFrames `lt-clean-bar` / generic chip. Extra time holds. */
const AUTHORED = 1.2;

function overlayPos(
  position: LowerThirdsContent["position"],
): CSSProperties {
  switch (position) {
    case "upper-left":
      return { left: 72, top: 160 };
    case "corner":
      return { right: 72, bottom: 220 };
    case "lower-left":
      return { left: 72, bottom: 160 };
    case "lower-third":
      return { left: 72, bottom: 140 };
  }
}

export function LowerThird({
  content,
  style,
  localSec,
  durationSec,
}: {
  content: LowerThirdsContent;
  style: CaptionGroupStyle;
  localSec: number;
  durationSec: number;
}) {
  const look = motionLook(style);
  const t = playheadSec(localSec, AUTHORED, durationSec);
  const accent = content.brandColors[0] ?? look.fill;
  if (content.kind === "chip") {
    return <Chip content={content} look={look} accent={accent} t={t} />;
  }
  return <NameBar content={content} look={look} accent={accent} t={t} />;
}

function NameBar({
  content,
  look,
  accent,
  t,
}: {
  content: LowerThirdsContent;
  look: MotionLook;
  accent: string;
  t: number;
}) {
  const wipe = span(t, 0.1, 0.55, easeOutCubic);
  const tab = span(t, 0.28, 0.45, easeOutCubic);
  const titleU = span(t, 0.34, 0.5, easeOutCubic);
  const detailU = span(t, 0.44, 0.5, easeOutCubic);

  return (
    <div
      style={{
        position: "absolute",
        ...overlayPos(content.position),
        display: "flex",
        alignItems: "stretch",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 14px 44px rgba(15,17,21,0.18)",
        clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
      }}
    >
      <div
        style={{
          width: 12,
          background: accent,
          transform: `scaleY(${tab})`,
          transformOrigin: "50% 0%",
        }}
      />
      <div
        style={{
          background: "#ffffff",
          padding: "22px 40px 24px 30px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        <div
          style={{
            fontFamily: look.font.fontFamily,
            fontWeight: 700,
            fontSize: 42,
            color: "#0f1115",
            lineHeight: 1.06,
            whiteSpace: "nowrap",
            opacity: titleU,
            transform: `translateY(${(1 - titleU) * 22}px)`,
          }}
        >
          {content.title}
        </div>
        {content.detail.trim() ? (
          <div
            style={{
              fontFamily: look.font.fontFamily,
              fontWeight: 400,
              fontSize: 22,
              color: "#5a6170",
              whiteSpace: "nowrap",
              opacity: detailU,
              transform: `translateY(${(1 - detailU) * 22}px)`,
            }}
          >
            {content.detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  content,
  look,
  accent,
  t,
}: {
  content: LowerThirdsContent;
  look: MotionLook;
  accent: string;
  t: number;
}) {
  const enter = span(t, 0.08, 0.45, easeOutCubic);
  const detail = content.detail.trim();

  return (
    <div
      style={{
        position: "absolute",
        ...overlayPos(content.position),
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(15,17,21,0.88)",
        borderRadius: 999,
        padding: detail ? "14px 22px 14px 18px" : "14px 20px",
        boxShadow: "0 10px 32px rgba(0,0,0,0.28)",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px) scale(${0.94 + 0.06 * enter})`,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: accent,
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: look.font.fontFamily,
            fontWeight: 700,
            fontSize: 28,
            color: "#fff",
            letterSpacing: 0.4,
            whiteSpace: "nowrap",
          }}
        >
          {content.title}
        </span>
        {detail ? (
          <span
            style={{
              fontFamily: look.font.fontFamily,
              fontWeight: 500,
              fontSize: 22,
              color: "rgba(255,255,255,0.72)",
              whiteSpace: "nowrap",
            }}
          >
            {detail}
          </span>
        ) : null}
      </div>
    </div>
  );
}
