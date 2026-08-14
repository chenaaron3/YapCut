import React, { Children, isValidElement } from "react";

import { DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";
import { ArcLayoutContext, layoutCaptionArc, type ArcLayout } from "./arc-layout";
import { captionGroupCss } from "./caption-style-css";
import { CaptionBackground } from "./CaptionBackground";

import type {
  BackgroundKind,
  BackgroundStyle,
  CaptionGroupStyle,
} from "~/remotion/captions/style";
import type { CaptionGroupProp } from "~/remotion/helpers/types";
import type { CSSProperties, ReactNode } from "react";

function rowJustify(
  textAlign: "left" | "center" | "right",
): CSSProperties["justifyContent"] {
  if (textAlign === "left") return "flex-start";
  if (textAlign === "right") return "flex-end";
  return "center";
}

function hugsContent(kind: BackgroundKind): boolean {
  return kind === "box" || kind === "ribbon" || kind === "underline";
}

function wordRowGap(style: CaptionGroupStyle): string {
  const kind = style.wordStyle.background?.kind;
  return kind === "scrap" || kind === "rounded" ? "0.45em 0.55em" : "0.35em";
}

/** Marker: splits static overlay words onto the next line. */
export function CaptionLineBreak() {
  return <span data-caption-line-break="" />;
}

function isLineBreakChild(child: ReactNode): boolean {
  return isValidElement(child) && child.type === CaptionLineBreak;
}

function partitionLines(children: ReactNode): ReactNode[][] {
  const items = Children.toArray(children);
  const lines: ReactNode[][] = [[]];
  for (const child of items) {
    if (isLineBreakChild(child)) {
      lines.push([]);
    } else {
      lines[lines.length - 1]!.push(child);
    }
  }
  return lines;
}

function spacedWords(line: ReactNode[]): ReactNode[] {
  return line.flatMap((child, j) => (j === 0 ? [child] : [" ", child]));
}

function groupShellStyle(
  style: CaptionGroupStyle,
): CSSProperties {
  const justify = rowJustify(style.textAlign);
  return {
    position: "relative",
    display: "flex",
    justifyContent: justify,
    width: "fit-content",
    maxWidth: "100%",
  };
}

type PackedGroup = {
  innerStyle: CSSProperties;
  body: ReactNode;
  background: BackgroundStyle;
};

/** Glyph box: poses on context. Wrap chrome cannot follow the circle. */
function packArc(
  children: ReactNode,
  style: CaptionGroupStyle,
  textStyle: CSSProperties,
  arc: ArcLayout,
): PackedGroup {
  return {
    innerStyle: {
      ...textStyle,
      textTransform: "none",
      position: "relative",
      display: "inline-block",
      width: arc.width,
      height: arc.height,
      maxWidth: "100%",
    },
    body: children,
    background:
      style.background.kind === "wrap" ? { kind: "none" } : style.background,
  };
}

/**
 * Inline/flex word packing. ContourBoard (`wrap`) needs inline line boxes;
 * everything else is a flex row (or column of rows).
 */
function packFlow(
  children: ReactNode,
  style: CaptionGroupStyle,
  textStyle: CSSProperties,
): PackedGroup {
  const wrap = style.background.kind === "wrap";
  const gap = wordRowGap(style);
  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: rowJustify(style.textAlign),
    gap,
  };
  const lines = partitionLines(children);
  const multiLine = lines.length > 1;

  if (wrap) {
    const body = lines.flatMap((line, i) => {
      const words = spacedWords(line);
      if (i === 0) return words;
      return [<br key={`br-${i}`} />, ...words];
    });
    return {
      innerStyle: { ...textStyle, width: "fit-content", maxWidth: "100%" },
      body,
      background: style.background,
    };
  }

  const body = multiLine
    ? lines.map((line, i) => (
        <span
          key={`line-${i}`}
          style={{
            ...rowStyle,
            width: "100%",
            minHeight: line.length === 0 ? "1em" : undefined,
          }}
        >
          {line}
        </span>
      ))
    : (lines[0] ?? []);

  return {
    innerStyle: {
      ...textStyle,
      ...(multiLine
        ? {
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "center",
          }
        : rowStyle),
      gap,
      width: hugsContent(style.background.kind) ? "auto" : "100%",
      maxWidth: "100%",
    },
    body,
    background: style.background,
  };
}

export type CaptionGroupLayoutProps = {
  group: CaptionGroupProp;
  children: ReactNode;
};

/**
 * Background + packing for one group. Does not place in the world.
 * `packFlow` — inline (wrap/ContourBoard) or flex rows.
 * `packArc` — sized box + ArcLayoutContext; wrap chrome is dropped.
 */
export const CaptionGroupLayout: React.FC<CaptionGroupLayoutProps> = ({
  group,
  children,
}) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const textStyle: CSSProperties = {
    ...captionGroupCss(style),
    color: style.wordStyle.fill,
  };
  const arc = layoutCaptionArc(group, style);
  const packed = arc
    ? packArc(children, style, textStyle, arc)
    : packFlow(children, style, textStyle);

  return (
    <div style={groupShellStyle(style)}>
      <CaptionBackground
        background={packed.background}
        textAlign={style.textAlign}
        textStyle={textStyle}
        style={packed.innerStyle}
      >
        <ArcLayoutContext.Provider value={arc}>
          {packed.body}
        </ArcLayoutContext.Provider>
      </CaptionBackground>
    </div>
  );
};
