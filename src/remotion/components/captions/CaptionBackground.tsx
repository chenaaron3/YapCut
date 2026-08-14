import React, { type CSSProperties, type ReactNode } from "react";

import type { BackgroundKind, BackgroundStyle } from "~/remotion/captions/style";

import { ContourBoard } from "./ContourBoard";

function scrapClipPath(index: number): string {
  const variants = [
    "polygon(2% 8%, 96% 3%, 100% 88%, 4% 97%)",
    "polygon(0% 12%, 98% 0%, 94% 100%, 3% 90%)",
    "polygon(4% 0%, 100% 6%, 97% 94%, 0% 100%)",
    "polygon(1% 5%, 100% 2%, 96% 100%, 0% 92%)",
  ];
  return variants[index % variants.length]!;
}

/** Continuous torn-paper strip (jagged top + bottom, hugs the text box). */
export function ribbonClipPath(): string {
  const steps = 18;
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = 0.6 + t * 98.8;
    const jag =
      Math.sin(t * Math.PI * 5.2) * 0.45 +
      Math.sin(t * Math.PI * 9.1) * 0.28 +
      Math.sin(t * Math.PI * 2.4) * 0.18;
    const notch = i % 3 === 0 ? 2.2 : i % 3 === 1 ? -1.1 : 0.6;
    const topY = 7.5 + jag * 7.5 + notch;
    const botY = 92.5 - jag * 7.2 - (i % 3 === 2 ? 2.4 : 0.4);
    top.push(`${x.toFixed(2)}% ${Math.min(16, Math.max(1.5, topY)).toFixed(2)}%`);
    bot.push(`${x.toFixed(2)}% ${Math.min(98.5, Math.max(84, botY)).toFixed(2)}%`);
  }
  return `polygon(${top.join(", ")}, ${bot.reverse().join(", ")})`;
}

export function scrapRotationDeg(index: number): number {
  return ((index * 37) % 13) - 6;
}

/** Apply alpha to hex/rgb/rgba color strings for background fade-in. */
export function applyColorOpacity(color: string, alpha: number): string {
  const c = color.trim();
  if (alpha >= 1) return c;
  if (alpha <= 0) return "transparent";

  const hex = /^#([0-9a-fA-F]{6})$/.exec(c);
  if (hex) {
    const h = hex[1]!;
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgba =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      c,
    );
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const baseAlpha = rgba[4] != null ? Number(rgba[4]) : 1;
    return `rgba(${r}, ${g}, ${b}, ${baseAlpha * alpha})`;
  }

  return c;
}

type ChromeKind = Exclude<BackgroundKind, "none" | "wrap">;

const GROUP_CHROME: Record<
  ChromeKind,
  (color: string | undefined, index: number) => CSSProperties
> = {
  box: (color) => {
    const fill = color !== undefined && color !== "" ? color : "rgba(0, 0, 0, 0.82)";
    if (!color) {
      return {
        backgroundColor: fill,
        padding: "0.35em 0.55em",
        borderRadius: 8,
      };
    }
    return {
      backgroundColor: fill,
      borderRadius: 24,
      padding: "28px 32px",
      boxShadow: "0 6px 0 rgba(0, 0, 0, 0.35)",
      boxSizing: "border-box",
    };
  },
  rounded: (color) => ({
    backgroundColor:
      color !== undefined && color !== "" ? color : "rgba(0, 0, 0, 0.78)",
    padding: "0.12em 0.4em",
    borderRadius: 999,
  }),
  scrap: (color, index) => ({
    backgroundColor: color !== undefined && color !== "" ? color : "#FFFFFF",
    padding: "0.12em 0.28em",
    clipPath: scrapClipPath(index),
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  }),
  ribbon: (color) => ({
    backgroundColor: color !== undefined && color !== "" ? color : "#FFFFFF",
    padding: "0.42em 0.78em 0.38em",
    clipPath: ribbonClipPath(),
  }),
  underline: (color) => ({
    borderBottom: `0.14em solid ${
      color !== undefined && color !== "" ? color : "#FFE600"
    }`,
    padding: "0 0.04em 0.08em",
  }),
};

const WORD_CHROME: Record<
  ChromeKind,
  (fill: string, index: number) => CSSProperties
> = {
  rounded: (fill) => ({ backgroundColor: fill, borderRadius: "0.15em" }),
  scrap: (fill, index) => ({ backgroundColor: fill, clipPath: scrapClipPath(index) }),
  ribbon: (fill) => ({ backgroundColor: fill, clipPath: ribbonClipPath() }),
  box: (fill) => ({ backgroundColor: fill, borderRadius: 4 }),
  underline: (fill) => ({
    borderBottom: `0.1em solid ${fill}`,
    paddingBottom: "0.04em",
  }),
};

function isChromeKind(kind: BackgroundKind): kind is ChromeKind {
  return kind !== "none" && kind !== "wrap";
}

/** CSS chrome for box / rounded / scrap / ribbon / underline. */
export function backgroundChromeStyle(
  background: BackgroundStyle | null | undefined,
  index = 0,
): CSSProperties {
  if (!background || !isChromeKind(background.kind)) return {};
  return GROUP_CHROME[background.kind](background.color?.trim(), index);
}

/** Word-level highlight — color inside the glyph box, no extra padding. */
export function wordBackgroundChromeStyle(
  background: BackgroundStyle | null | undefined,
  index = 0,
  opacity = 1,
): CSSProperties {
  if (!background || !isChromeKind(background.kind)) return {};
  const color = background.color?.trim();
  if (!color || opacity <= 0) return {};
  return WORD_CHROME[background.kind](applyColorOpacity(color, opacity), index);
}

type GroupBgProps = {
  background: BackgroundStyle;
  index: number;
  style?: CSSProperties;
  textStyle?: CSSProperties;
  textAlign: "left" | "center" | "right";
  children: ReactNode;
};

function NoneBackground({ style, children }: GroupBgProps) {
  if (!style) return <>{children}</>;
  return <span style={style}>{children}</span>;
}

function WrapBackground({
  background,
  textAlign,
  textStyle,
  children,
}: GroupBgProps) {
  return (
    <ContourBoard
      fill={background.color?.trim() ? background.color.trim() : "#FFFFFF"}
      textAlign={textAlign}
      textStyle={textStyle ?? {}}
    >
      {children}
    </ContourBoard>
  );
}

function ChromeBackground({
  background,
  index,
  style,
  children,
}: GroupBgProps) {
  const scrap =
    background.kind === "scrap"
      ? { transform: `rotate(${scrapRotationDeg(index)}deg)` }
      : {};
  return (
    <span
      style={{
        display: "inline-block",
        ...backgroundChromeStyle(background, index),
        ...scrap,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const GROUP_BACKGROUND: Record<BackgroundKind, React.FC<GroupBgProps>> = {
  none: NoneBackground,
  wrap: WrapBackground,
  box: ChromeBackground,
  rounded: ChromeBackground,
  scrap: ChromeBackground,
  ribbon: ChromeBackground,
  underline: ChromeBackground,
};

/**
 * Shared background wrapper for group or word.
 * `BackgroundKind` → component. Word chrome uses the same map (tight variant).
 */
export const CaptionBackground: React.FC<{
  background: BackgroundStyle | null | undefined;
  index?: number;
  style?: CSSProperties;
  /** Typography for ContourBoard fill/text flow (wrap only). */
  textStyle?: CSSProperties;
  textAlign?: "left" | "center" | "right";
  children: ReactNode;
}> = ({
  background,
  index = 0,
  style,
  textStyle,
  textAlign = "center",
  children,
}) => {
  const kind = background?.kind ?? "none";
  const Cmp = GROUP_BACKGROUND[kind];
  return (
    <Cmp
      background={background ?? { kind: "none" }}
      index={index}
      style={style}
      textStyle={textStyle}
      textAlign={textAlign}
    >
      {children}
    </Cmp>
  );
};
