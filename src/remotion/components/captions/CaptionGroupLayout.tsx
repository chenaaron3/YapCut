import React, {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react";

import { DEFAULT_CAPTION_STYLE } from "~/remotion/captions/style";
import type { CaptionGroupProp } from "~/remotion/types";

import { CaptionBackground } from "./CaptionBackground";
import { captionGroupCss } from "./caption-style-css";

function rowJustify(
  textAlign: "left" | "center" | "right",
): CSSProperties["justifyContent"] {
  if (textAlign === "left") return "flex-start";
  if (textAlign === "right") return "flex-end";
  return "center";
}

/** Marker: splits static overlay words onto the next line. */
export function CaptionLineBreak({
  hidden = false,
}: {
  hidden?: boolean;
  silhouette?: boolean;
}) {
  if (hidden) return null;
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
 */
export const CaptionGroupLayout: React.FC<CaptionGroupLayoutProps> = ({
  group,
  shellStyle,
  embedded = false,
  children,
}) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const background = style.background;
  const textAlign = style.textAlign;
  const wrap = background.kind === "wrap";
  const baseText = captionGroupCss(style);
  const textStyle: CSSProperties = {
    ...baseText,
    color: style.wordStyle.fill,
  };
  const gap =
    style.wordStyle.background?.kind === "scrap" ||
    style.wordStyle.background?.kind === "rounded"
      ? "0.45em 0.55em"
      : "0.35em";

  const lines = partitionLines(children);
  const multiLine = lines.length > 1;

  // ContourBoard needs inline line boxes — spaces between words, <br> between lines.
  const wrapContent = lines.flatMap((line, i) => {
    const words = spacedWords(line);
    if (i === 0) return words;
    return [<br key={`br-${i}`} />, ...words];
  });

  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: rowJustify(textAlign),
    gap,
  };

  const flexContent = multiLine
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

  const innerStyle: CSSProperties = wrap
    ? {
        ...textStyle,
        width: "100%",
        maxWidth: "100%",
      }
    : {
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
        width: background.kind === "box" ? "auto" : "100%",
        maxWidth: "100%",
      };

  return (
    <div
      style={
        embedded
          ? {
              position: "relative",
              display: "flex",
              justifyContent: rowJustify(textAlign),
              width: "100%",
              ...shellStyle,
            }
          : {
              position: "absolute",
              top: `${style.y * 100}%`,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: rowJustify(textAlign),
              transform: "translateY(-50%)",
              ...shellStyle,
            }
      }
    >
      <CaptionBackground
        background={background}
        textAlign={textAlign}
        textStyle={textStyle}
        style={innerStyle}
      >
        {wrap ? wrapContent : flexContent}
      </CaptionBackground>
    </div>
  );
};
