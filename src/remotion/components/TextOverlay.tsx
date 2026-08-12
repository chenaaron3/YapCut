import { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import { buildStaticGroup } from "~/remotion/components/captions/static-group";
import { StackedCaptionPair } from "~/remotion/components/captions/StackedCaptionPair";
import { StaticGroupView } from "~/remotion/components/captions/StaticGroupView";
import { SAFE_AREA } from "~/remotion/constants";
import { resolveTemplateId } from "~/remotion/templates/style";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextLayerStyles,
} from "~/remotion/templates/text";
import type { TextOverlayProp } from "~/remotion/types";

import type { CaptionGroupStyle } from "~/remotion/captions/style";

function StaticLayer({
  text,
  style,
  durationFrames,
  frame,
  fps,
  embedded,
}: {
  text: string;
  style: CaptionGroupStyle;
  durationFrames: number;
  frame: number;
  fps: number;
  embedded: boolean;
}) {
  const group = useMemo(
    () => buildStaticGroup(text, style, fps, durationFrames),
    [text, style, fps, durationFrames],
  );

  if (!text.trim() || frame < 0 || frame >= durationFrames) return null;

  return (
    <StaticGroupView
      group={group}
      frame={frame}
      fps={fps}
      embedded={embedded}
    />
  );
}

function TextOverlayItem({ overlay }: { overlay: TextOverlayProp }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const templateId = resolveTemplateId(
    overlay.style,
    isTextTemplateId,
    DEFAULT_TEXT_TEMPLATE_ID,
  );
  const { heading, subheading } = resolveTextLayerStyles(
    templateId,
    overlay.style?.overrides,
  );
  const durationFrames = Math.max(1, overlay.endFrame - overlay.startFrame);
  const headingText = overlay.text.trim();
  const subText = overlay.subheading.trim();

  if (frame >= durationFrames) return null;
  if (!headingText && !subText) return null;

  const stacked = Boolean(headingText && subText);

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
      }}
    >
      {stacked ? (
        <StackedCaptionPair y={heading.y}>
          <StaticLayer
            text={headingText}
            style={heading}
            durationFrames={durationFrames}
            frame={frame}
            fps={fps}
            embedded
          />
          <StaticLayer
            text={subText}
            style={subheading}
            durationFrames={durationFrames}
            frame={frame}
            fps={fps}
            embedded
          />
        </StackedCaptionPair>
      ) : (
        <StaticLayer
          text={headingText || subText}
          style={
            headingText ? heading : { ...subheading, y: heading.y }
          }
          durationFrames={durationFrames}
          frame={frame}
          fps={fps}
          embedded={false}
        />
      )}
    </AbsoluteFill>
  );
}

export function TextOverlay({ overlays }: { overlays: TextOverlayProp[] }) {
  return (
    <>
      {overlays.map((overlay) => {
        const durationInFrames = Math.max(
          1,
          overlay.endFrame - overlay.startFrame,
        );
        return (
          <Sequence
            key={overlay.id}
            from={overlay.startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <TextOverlayItem overlay={overlay} />
          </Sequence>
        );
      })}
    </>
  );
}
