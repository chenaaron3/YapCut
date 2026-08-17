import { Video } from "@remotion/media";
import { AbsoluteFill, Freeze, Sequence, useVideoConfig } from "remotion";

import { PREMOUNT_SEC } from "~/remotion/helpers/constants";

import type {
  TransitionClipProp,
  TransitionPictureProp,
} from "~/remotion/helpers/types";
import type { CSSProperties } from "react";

const VIDEO_FILL: CSSProperties = { width: "100%", height: "100%" };

function Still({
  picture,
  at,
}: {
  picture: TransitionPictureProp;
  at: "first" | "last";
}) {
  const frame = at === "first" ? picture.trimBefore : picture.freezeFrame;
  return (
    <Freeze frame={0}>
      <Video
        src={picture.src}
        trimBefore={frame}
        trimAfter={frame + 1}
        volume={0}
        objectFit="cover"
        style={VIDEO_FILL}
      />
    </Freeze>
  );
}

function Playing({ picture }: { picture: TransitionPictureProp }) {
  return (
    <Video
      src={picture.src}
      trimBefore={picture.trimBefore}
      trimAfter={picture.trimAfter}
      volume={0}
      objectFit="cover"
      style={VIDEO_FILL}
    />
  );
}

function KeepLayer({
  picture,
  from,
  durationInFrames,
  premountFor,
  hold,
}: {
  picture: TransitionPictureProp;
  from: number;
  durationInFrames: number;
  premountFor: number;
  hold: "first" | "last";
}) {
  return (
    <AbsoluteFill>
      <Still picture={picture} at={hold} />
      {durationInFrames > 0 ? (
        <Sequence
          from={from}
          durationInFrames={durationInFrames}
          premountFor={premountFor}
        >
          <Playing picture={picture} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

/** Shared interior compositor: two keep layers + per-side styles. */
export function StitchOverlay({
  clip,
  outStyle,
  inStyle,
}: {
  clip: TransitionClipProp;
  outStyle: CSSProperties;
  inStyle: CSSProperties;
}) {
  const { fps } = useVideoConfig();
  const premountFor = Math.round(PREMOUNT_SEC * fps);
  const duration = Math.max(1, clip.endFrame - clip.startFrame);
  const stitchLocal = Math.min(
    duration - 1,
    Math.max(1, clip.stitchFrame - clip.startFrame),
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      {clip.out ? (
        <AbsoluteFill style={outStyle}>
          <KeepLayer
            picture={clip.out}
            from={0}
            durationInFrames={stitchLocal}
            premountFor={premountFor}
            hold="last"
          />
        </AbsoluteFill>
      ) : null}
      {clip.in ? (
        <AbsoluteFill style={inStyle}>
          <KeepLayer
            picture={clip.in}
            from={stitchLocal}
            durationInFrames={Math.max(0, duration - stitchLocal)}
            premountFor={premountFor}
            hold="first"
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
