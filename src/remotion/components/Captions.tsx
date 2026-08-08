import { AbsoluteFill, useCurrentFrame } from "remotion";

import {
  resolveCaptionStyle,
  transformCaptionText,
} from "~/remotion/captions/templates";
import { SAFE_AREA } from "~/remotion/constants";
import type { CaptionGroupProp } from "~/remotion/types";

export function Captions({
  groups,
  templateId,
  overrides,
}: {
  groups: CaptionGroupProp[];
  templateId: string;
  overrides?: Record<string, unknown>;
}) {
  const frame = useCurrentFrame();
  const style = resolveCaptionStyle(templateId, overrides);
  const active = groups.find(
    (g) => frame >= g.startFrame && frame < g.endFrame,
  );
  if (!active) return null;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        top: SAFE_AREA.top,
        bottom: SAFE_AREA.bottom,
        left: SAFE_AREA.left,
        right: SAFE_AREA.right,
        width: "auto",
        height: "auto",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: "8%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.25em",
          maxWidth: "100%",
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: 1.2,
          textAlign: "center",
        }}
      >
        {active.words.map((word, i) => {
          const isActive =
            frame >= word.startFrame && frame < word.endFrame;
          const isFuture = frame < word.startFrame;
          const fill = word.emphasized ? "#FFE600" : style.fill;
          const bg =
            isActive && style.activeBackground
              ? style.activeBackground
              : word.emphasized && !isActive
                ? "rgba(255,230,0,0.25)"
                : "transparent";

          return (
            <span
              key={`${word.startFrame}-${i}`}
              style={{
                color: fill,
                opacity: isFuture ? style.futureOpacity : 1,
                background: bg,
                borderRadius: 8,
                padding: "0 0.12em",
                textShadow: style.textShadow,
                WebkitTextStroke: `${style.borderWidth}px ${style.borderColor}`,
                paintOrder: "stroke fill",
                textTransform: style.textTransform,
              }}
            >
              {transformCaptionText(word.text, "none")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
