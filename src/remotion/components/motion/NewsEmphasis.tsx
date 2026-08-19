import {
  easeOutCubic,
  playheadSec,
  span,
} from "~/remotion/components/motion/clock";
import { motionLook } from "~/remotion/components/motion/look";

import type { CSSProperties } from "react";
import type { NewsContent } from "~/domain/motion-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

/** Text-only news card. Keyword marker-band after the line settles. */
const AUTHORED = 4.2;
const INK = "#161513";
const MUTED = "#4a4740";

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findKeywordSpan(
  headline: string,
  keyword: string,
): { start: number; length: number } | null {
  const key = keyword.trim();
  if (!key || !headline.trim()) return null;
  const exact = headline.toLowerCase().indexOf(key.toLowerCase());
  if (exact >= 0) return { start: exact, length: key.length };

  const words = key.split(/\s+/).filter(Boolean).map(escapeRe);
  if (words.length === 0) return null;
  const loose = new RegExp(words.join("[\\s\\S]{0,24}?"), "i");
  const match = headline.match(loose);
  if (match?.index == null) return null;
  return { start: match.index, length: match[0].length };
}

function splitKeyword(headline: string, keyword: string): [string, string, string] {
  const found = findKeywordSpan(headline, keyword);
  if (!found) return [headline, "", ""];
  return [
    headline.slice(0, found.start),
    headline.slice(found.start, found.start + found.length),
    headline.slice(found.start + found.length),
  ];
}

export function NewsEmphasis({
  content,
  style,
  localSec,
  durationSec,
}: {
  content: NewsContent;
  style: CaptionGroupStyle;
  localSec: number;
  durationSec: number;
}) {
  const look = motionLook(style);
  const t = playheadSec(localSec, AUTHORED, durationSec);
  const kickerU = span(t, 0, 0.5, easeOutCubic);
  const sentU = span(t, 0.35, 0.8, easeOutCubic);
  const hlw = span(t, 1.4, 0.9, easeOutCubic) * 100;
  const [pre, key, post] = splitKeyword(content.headline, content.keyword);
  const outlet = content.outlet.trim();
  const kicker = content.kicker.trim();
  const masthead = kicker || outlet;
  const showOutlet =
    Boolean(outlet) &&
    Boolean(kicker) &&
    outlet.toLowerCase() !== kicker.toLowerCase();

  const label: CSSProperties = {
    ...look.font,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.14em",
    lineHeight: 1.3,
    textTransform: "uppercase",
    color: MUTED,
    opacity: kickerU,
  };

  return (
    <div
      style={{
        width: 860,
        padding: "36px 40px 40px",
        background: "#f7f4ea",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        boxSizing: "border-box",
        boxShadow: "0 18px 48px rgba(22,21,19,0.22)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 3,
          background: look.fill,
          opacity: kickerU,
          marginBottom: 20,
        }}
      />
      {showOutlet ? (
        <div style={{ ...label, color: INK, marginBottom: 8 }}>
          {outlet}
        </div>
      ) : null}
      {masthead ? (
        <div style={{ ...label, marginBottom: 20 }}>{masthead}</div>
      ) : null}
      <div
        style={{
          fontFamily: "Georgia, 'Times New Roman', Times, serif",
          fontSize: 36,
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: "-0.015em",
          color: INK,
          textAlign: "left",
          maxWidth: 760,
          opacity: sentU,
          transform: `translateY(${(1 - sentU) * 16}px)`,
        }}
      >
        {pre}
        {key ? (
          <span
            style={{
              padding: "0.08em 0.22em",
              margin: "0 0.06em",
              letterSpacing: "0.01em",
              backgroundImage: "linear-gradient(#f5d76e, #f5d76e)",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "left center",
              backgroundSize: `${hlw}% 100%`,
              borderRadius: 3,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {key}
          </span>
        ) : null}
        {post}
      </div>
    </div>
  );
}
