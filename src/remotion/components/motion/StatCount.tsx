import {
  easeBackOut,
  easeOutCubic,
  playheadSec,
  span,
} from "~/remotion/components/motion/clock";
import { motionLook } from "~/remotion/components/motion/look";

import type { StatContent } from "~/domain/vfx/motion-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

/** Authored length of HyperFrames `apple-money-count`. */
const AUTHORED = 4.7;

function formatValue(value: number, prefix: string, suffix: string): string {
  const rounded = Math.round(value);
  const body = Number.isFinite(rounded)
    ? rounded.toLocaleString("en-US")
    : "0";
  return `${prefix}${body}${suffix}`;
}

const BURST = Array.from({ length: 24 }, (_, i) => {
  const angle = i * 2.399963229728653;
  const ring = i % 5;
  return {
    x: Math.cos(angle) * (90 + ring * 38 + (i % 7) * 6),
    y: Math.sin(angle * 1.13) * (70 + ring * 28),
    delay: (i % 8) * 0.025,
    duration: 0.74 + (i % 5) * 0.045,
    fadeDelay: (i % 5) * 0.05,
    rotation: ((i * 43) % 160) - 80,
    scale: 0.68 + (i % 5) * 0.07,
    size: 10 + (i % 4) * 5,
  };
});

export function StatCount({
  content,
  style,
  localSec,
  durationSec,
}: {
  content: StatContent;
  style: CaptionGroupStyle;
  localSec: number;
  durationSec: number;
}) {
  const look = motionLook(style);
  const t = playheadSec(localSec, AUTHORED, durationSec);
  const enter = span(t, 0, 0.45, easeOutCubic);
  const countU = span(t, 0, 3.16);
  const shown = content.value * countU;
  const pulse = t < 3.16 ? 1 : 1 + 0.06 * (1 - span(t, 3.16, 0.39, easeBackOut));
  const flash = t < 3.16 ? 0 : span(t, 3.16, 0.08) * 0.34 * (1 - span(t, 4, 0.16));
  const green = t >= 3.16;
  const ringU = content.ring ? span(t, 0.2, 3.0, easeOutCubic) : 0;
  const labelU = span(t, 3.2, 0.45, easeOutCubic);
  const color = green ? "#30d158" : look.fill;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 720,
        minHeight: 280,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -80,
          background: "#30d158",
          opacity: flash,
          pointerEvents: "none",
        }}
      />
      {content.ring ? (
        <svg
          width={280}
          height={280}
          viewBox="0 0 280 280"
          style={{ position: "absolute", opacity: 0.9 }}
        >
          <circle
            cx={140}
            cy={140}
            r={120}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={10}
          />
          <circle
            cx={140}
            cy={140}
            r={120}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - ringU)}
            transform="rotate(-90 140 140)"
          />
        </svg>
      ) : null}
      <div
        style={{
          ...look.font,
          ...look.paint,
          color,
          fontSize: 120,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 0.9,
          whiteSpace: "nowrap",
          textShadow: green
            ? "0 3px 0 rgba(255,255,255,0.52), 0 18px 40px rgba(48,209,88,0.3)"
            : "0 3px 0 rgba(255,255,255,0.58), 0 18px 36px rgba(17,19,21,0.14)",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 26}px) scale(${0.985 + 0.015 * enter}) scale(${pulse})`,
        }}
      >
        {formatValue(shown, content.prefix, content.suffix)}
      </div>
      {content.label.trim() ? (
        <div
          style={{
            ...look.font,
            marginTop: 18,
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(255,255,255,0.78)",
            opacity: labelU,
            transform: `translateY(${(1 - labelU) * 12}px)`,
          }}
        >
          {content.label}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {BURST.map((spec, i) => {
          const appear = span(t, 3.28 + spec.delay, spec.duration, easeOutCubic);
          const fade = span(t, 4.18 + spec.fadeDelay, 0.38);
          const opacity = appear * (1 - fade);
          if (opacity <= 0.01) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: spec.size,
                height: spec.size,
                borderRadius: "50%",
                background: color,
                opacity,
                transform: `translate(-50%, -50%) translate(${spec.x * appear}px, ${spec.y * appear}px) rotate(${spec.rotation * appear}deg) scale(${0.18 + spec.scale * appear})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
