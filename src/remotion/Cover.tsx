import { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";

import { SAFE_AREA } from "~/remotion/helpers/constants";
import type { ProjectProps } from "~/remotion/helpers/types";

const FONT_FAMILY = '"Montserrat", "Arial Black", Impact, sans-serif';
const MAX_FONT_SIZE = 110;
const MIN_FONT_SIZE = 36;
const STROKE_PX = 12;

function parsePercent(value: string): number {
  return Number.parseFloat(value) / 100;
}

function fitFontSize(text: string, maxWidthPx: number): number {
  if (typeof document === "undefined") {
    return MAX_FONT_SIZE;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return MAX_FONT_SIZE;
  }

  const lines = text
    .split(/\n/)
    .flatMap((line) => line.trim().split(/\s+/))
    .filter(Boolean)
    .map((line) => line.toUpperCase());

  for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 2) {
    ctx.font = `900 ${size}px ${FONT_FAMILY}`;
    const widest = Math.max(
      0,
      ...lines.map((line) => ctx.measureText(line).width),
    );
    if (widest + STROKE_PX * 2 <= maxWidthPx) {
      return size;
    }
  }

  return MIN_FONT_SIZE;
}

function EnsureMontserrat() {
  const [handle] = useState(() => delayRender("montserrat-cover-font"));

  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(
      "Montserrat",
      "url(https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCvC73w0aXpsog.woff2) format('woff2')",
      { weight: "900", style: "normal", display: "swap" },
    );

    face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
      })
      .catch((error: unknown) => {
        console.warn(
          "[Cover] Montserrat failed to load:",
          error instanceof Error ? error.message : error,
        );
      })
      .finally(() => {
        if (!cancelled) continueRender(handle);
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return null;
}

/** Single-frame cover: first keep frame + large centered title. */
export function Cover({ title, sections }: ProjectProps) {
  const { width } = useVideoConfig();
  const first = sections[0];

  const contentWidth =
    width * (1 - parsePercent(SAFE_AREA.left) - parsePercent(SAFE_AREA.right));
  const fontSize = useMemo(
    () => fitFontSize(title, contentWidth),
    [title, contentWidth],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <EnsureMontserrat />
      {first?.src ? (
        <Video
          src={first.src}
          trimBefore={first.trimBefore}
          trimAfter={Math.min(first.trimAfter, first.trimBefore + 1)}
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}

      <AbsoluteFill
        style={{
          top: SAFE_AREA.top,
          bottom: SAFE_AREA.bottom,
          left: SAFE_AREA.left,
          right: SAFE_AREA.right,
          width: "auto",
          height: "auto",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <h1
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            fontSize,
            lineHeight: 1.1,
            color: "#FFE600",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            WebkitTextStroke: `${STROKE_PX}px #000`,
            paintOrder: "stroke fill",
            textShadow: "0 0 1px #000",
            margin: 0,
            whiteSpace: "pre-line",
            maxWidth: "100%",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {title}
        </h1>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
