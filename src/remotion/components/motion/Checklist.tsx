import {
  easeBackOut,
  playheadSec,
  span,
} from "~/remotion/components/motion/clock";
import { motionLook } from "~/remotion/components/motion/look";

import type { CSSProperties } from "react";
import type { ChecklistContent } from "~/domain/vfx/motion-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

const SLAM = 0.36;
const STAGGER = 0.048;
const ROW = 92;

function wordsOf(label: string): string[] {
  return label.trim().split(/\s+/).filter(Boolean);
}

function authoredSec(content: ChecklistContent): number {
  let end = content.headline.trim() ? 0.9 : 0.2;
  for (const item of content.items) {
    const n = Math.max(1, wordsOf(item.label).length);
    end = Math.max(end, item.atSec + n * STAGGER + SLAM);
  }
  return Math.max(end, 1);
}

/**
 * Kinetic-type slam (HyperFrames caption-kinetic-slam / slam primitive):
 * scale+blur+alternating x, back.out thud. Per-word stagger; rows persist.
 */
function SlamWord({
  word,
  t,
  at,
  fromLeft,
  style,
}: {
  word: string;
  t: number;
  at: number;
  fromLeft: boolean;
  style: CSSProperties;
}) {
  const fade = span(t, at, 0.16);
  const slam = span(t, at, SLAM, easeBackOut);
  const dir = fromLeft ? -1 : 1;
  const blur = (1 - fade) * 12;
  return (
    <span
      style={{
        ...style,
        display: "inline-block",
        opacity: fade,
        transform: `translate(${dir * 34 * (1 - slam)}px, ${(1 - slam) * 16}px) scale(${1.55 - 0.55 * slam})`,
        filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
      }}
    >
      {word}
    </span>
  );
}

function SlamLine({
  text,
  t,
  at,
  fontSize,
  color,
  weight,
  look,
  tracking,
}: {
  text: string;
  t: number;
  at: number;
  fontSize: number;
  color: string;
  weight: number;
  look: ReturnType<typeof motionLook>;
  tracking?: number;
}) {
  const words = wordsOf(text);
  if (words.length === 0) return null;
  const paint: CSSProperties = {
    ...look.font,
    ...look.paint,
    fontSize,
    fontWeight: weight,
    color,
    lineHeight: 1.05,
    letterSpacing: tracking,
    textShadow: "0 10px 28px rgba(0,0,0,0.45)",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        columnGap: "0.28em",
        rowGap: 4,
        alignItems: "baseline",
      }}
    >
      {words.map((word, i) => (
        <SlamWord
          key={`${i}-${word}`}
          word={word}
          t={t}
          at={at + i * STAGGER}
          fromLeft={i % 2 === 0}
          style={paint}
        />
      ))}
    </span>
  );
}

export function Checklist({
  content,
  style,
  localSec,
  durationSec,
}: {
  content: ChecklistContent;
  style: CaptionGroupStyle;
  localSec: number;
  durationSec: number;
}) {
  const look = motionLook(style);
  const t = playheadSec(localSec, authoredSec(content), durationSec);
  const headline = content.headline.trim();

  return (
    <div
      style={{
        width: 860,
        minHeight: (headline ? 72 : 0) + content.items.length * ROW,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: 8,
        padding: "8px 12px",
      }}
    >
      {headline ? (
        <div style={{ minHeight: 56, marginBottom: 12 }}>
          <SlamLine
            text={headline}
            t={t}
            at={0}
            fontSize={28}
            color="rgba(255,255,255,0.72)"
            weight={700}
            look={look}
            tracking={3}
          />
        </div>
      ) : null}
      {content.items.map((item, i) => {
        const indexSlam = span(t, item.atSec, SLAM, easeBackOut);
        const indexFade = span(t, item.atSec, 0.14);
        const n = String(i + 1).padStart(2, "0");
        return (
          <div
            key={`${i}-${item.label}`}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 22,
              minHeight: ROW - 8,
            }}
          >
            <span
              style={{
                ...look.font,
                ...look.paint,
                width: 72,
                flexShrink: 0,
                fontSize: 36,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                color: look.fill,
                opacity: indexFade,
                transform: `scale(${1.7 - 0.7 * indexSlam})`,
                transformOrigin: "left center",
                textShadow: "0 8px 22px rgba(0,0,0,0.4)",
              }}
            >
              {n}
            </span>
            <SlamLine
              text={item.label}
              t={t}
              at={item.atSec}
              fontSize={56}
              color="#fff"
              weight={800}
              look={look}
            />
          </div>
        );
      })}
    </div>
  );
}
