import React, {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  DEFAULT_CAPTION_STYLE,
  captionSafeAreaT,
  type BackgroundKind,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";
import type { CaptionGroupProp } from "~/remotion/helpers/types";

import { CaptionBackground } from "./CaptionBackground";
import { ArcLayoutContext, layoutCaptionArc } from "./arc-layout";
import { captionGroupCss } from "./caption-style-css";

function rowJustify(
  textAlign: "left" | "center" | "right",
): CSSProperties["justifyContent"] {
  if (textAlign === "left") return "flex-start";
  if (textAlign === "right") return "flex-end";
  return "center";
}

function hugsContent(kind: BackgroundKind): boolean {
  return kind === "box" || kind === "ribbon";
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
  embedded: boolean,
  shellStyle: CSSProperties | undefined,
): CSSProperties {
  const justify = rowJustify(style.textAlign);
  if (embedded) {
    // fit-content: stacked overlay lines size to the widest child. width 100%
    // collapses to the narrowest sibling and the rest overflows the AABB.
    return {
      position: "relative",
      display: "flex",
      justifyContent: justify,
      width: "fit-content",
      maxWidth: "100%",
      ...shellStyle,
    };
  }
  return {
    position: "absolute",
    top: `${captionSafeAreaT(style.y) * 100}%`,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: justify,
    transform: "translateY(-50%)",
    ...shellStyle,
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
): { innerStyle: CSSProperties; body: ReactNode } {
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
  };
}

export type CaptionGroupLayoutProps = {
  group: CaptionGroupProp;
  /** Outer transform/opacity (e.g. group enter/exit). */
  shellStyle?: CSSProperties;
  /**
   * Flow layout for stacked parents (listicle indicator above value).
   * Skips absolute Y placement.
   */
  embedded?: boolean;
  children: ReactNode;
};

/**
 * Shared caption shell: safe-area Y, background, word row.
 * Motion policy and word paint live in the calling view (as children).
 * Inner packing is flow (flex/wrap) or arc (glyph poses on {@link CaptionWordSpan}).
 */
export const CaptionGroupLayout: React.FC<CaptionGroupLayoutProps> = ({
  group,
  shellStyle,
  embedded = false,
  children,
}) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const textStyle: CSSProperties = {
    ...captionGroupCss(style),
    color: style.wordStyle.fill,
  };
  const arc = layoutCaptionArc(group, style);
  const packed = arc
    ? {
        innerStyle: {
          ...textStyle,
          textTransform: "none" as const,
          position: "relative" as const,
          width: arc.width,
          height: arc.height,
          maxWidth: "100%",
        },
        body: children,
        background:
          style.background.kind === "wrap"
            ? { kind: "none" as const }
            : style.background,
      }
    : { ...packFlow(children, style, textStyle), background: style.background };

  return (
    <div style={groupShellStyle(style, embedded, shellStyle)}>
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
