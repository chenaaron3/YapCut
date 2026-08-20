import { evolvePath } from "@remotion/paths";
import React, { useId } from "react";

import { paintsScribble } from "~/domain/transcript/scribble";
import {
  SCRIBBLE_CATALOG,
  scribbleAuthoredMs,
  scribbleLayerProgress,
  scribbleWordT,
} from "~/remotion/components/captions/scribble-catalog";

import type { ScribbleId } from "~/domain/transcript/scribble";
import type { CaptionWordProp } from "~/remotion/helpers/types";
import type {
  ScribbleDefinition,
  ScribbleFillLayer,
  ScribbleStrokeLayer,
} from "~/remotion/components/captions/scribble-catalog";
import type { CSSProperties, ReactNode } from "react";

function StrokeLayer({
  layer,
  color,
  progress,
}: {
  layer: ScribbleStrokeLayer;
  color: string;
  progress: number;
}) {
  const dash = evolvePath(progress, layer.path);
  return (
    <path
      d={layer.path}
      fill="none"
      stroke={color}
      strokeWidth={layer.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={layer.opacity ?? 1}
      strokeDasharray={dash.strokeDasharray}
      strokeDashoffset={dash.strokeDashoffset}
    />
  );
}

function FillLayer({
  layer,
  color,
  progress,
  maskId,
}: {
  layer: ScribbleFillLayer;
  color: string;
  progress: number;
  maskId: string;
}) {
  const dash = evolvePath(progress, layer.reveal.path);
  return (
    <>
      <defs>
        <mask id={maskId}>
          <path
            d={layer.reveal.path}
            fill="none"
            stroke="white"
            strokeWidth={layer.reveal.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dash.strokeDasharray}
            strokeDashoffset={dash.strokeDashoffset}
          />
        </mask>
      </defs>
      <path
        d={layer.path}
        fill={color}
        opacity={layer.opacity}
        mask={`url(#${maskId})`}
      />
    </>
  );
}

function ScribbleSvg({
  definition,
  color,
  frame,
  fps,
  wordStartFrame,
  wordEndFrame,
  zIndex,
}: {
  definition: ScribbleDefinition;
  color: string;
  frame: number;
  fps: number;
  wordStartFrame: number;
  wordEndFrame: number;
  zIndex: number;
}) {
  const reactId = useId().replaceAll(":", "");
  const wordT = scribbleWordT(frame, wordStartFrame, wordEndFrame);
  const authoredMs = scribbleAuthoredMs(definition);
  const lastLocal = Math.max(1, wordEndFrame - wordStartFrame) - 1;
  const wordVisibleMs = lastLocal <= 0 ? 0 : (lastLocal / fps) * 1000;
  return (
    <svg
      viewBox={definition.viewBox}
      preserveAspectRatio={definition.preserveAspectRatio}
      aria-hidden
      style={{
        position: "absolute",
        pointerEvents: "none",
        overflow: "visible",
        zIndex,
        top: definition.placement.top,
        left: definition.placement.left,
        width: definition.placement.width,
        height: definition.placement.height,
      }}
    >
      {definition.layers.map((layer, index) => {
        const progress = scribbleLayerProgress(
          wordT,
          layer.timing,
          authoredMs,
          wordVisibleMs,
        );
        if (layer.type === "fill") {
          return (
            <FillLayer
              key={index}
              layer={layer}
              color={color}
              progress={progress}
              maskId={`scribble-${reactId}-${index}`}
            />
          );
        }
        return (
          <StrokeLayer
            key={index}
            layer={layer}
            color={color}
            progress={progress}
          />
        );
      })}
    </svg>
  );
}

/** Draw-on scribble around an emphasized flow word. Arc captions skip this. */
export const ScribbleMark: React.FC<{
  markId: ScribbleId;
  color: string;
  frame: number;
  fps: number;
  wordStartFrame: number;
  wordEndFrame: number;
  zIndex: number;
}> = ({ markId, color, frame, fps, wordStartFrame, wordEndFrame, zIndex }) => {
  const definition = SCRIBBLE_CATALOG[markId];
  return (
    <ScribbleSvg
      definition={definition}
      color={color}
      frame={frame}
      fps={fps}
      wordStartFrame={wordStartFrame}
      wordEndFrame={wordEndFrame}
      zIndex={zIndex}
    />
  );
};

/**
 * Word box + optional scribble overlay. Owns behind/front stacking so caption
 * paint does not have to know scribble layers.
 */
export function ScribbleWordFrame({
  word,
  color,
  frame,
  fps,
  style,
  children,
}: {
  word: CaptionWordProp;
  color: string;
  frame: number;
  fps: number;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (!paintsScribble(word)) {
    return <span style={style}>{children}</span>;
  }
  const behind = SCRIBBLE_CATALOG[word.scribble].layer === "behind";
  return (
    <span style={{ ...style, position: "relative" }}>
      <ScribbleMark
        markId={word.scribble}
        color={color}
        frame={frame}
        fps={fps}
        wordStartFrame={word.startFrame}
        wordEndFrame={word.endFrame}
        zIndex={behind ? 0 : 1}
      />
      <span style={{ position: "relative", zIndex: behind ? 1 : 0 }}>
        {children}
      </span>
    </span>
  );
}
