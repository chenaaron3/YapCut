import { AbsoluteFill, Freeze, Sequence, useVideoConfig } from "remotion";

import { MaskedMedia } from "~/remotion/components/MaskedMedia";
import { PREMOUNT_SEC } from "~/remotion/helpers/constants";

import type {
  TransitionClipProp,
  TransitionPictureProp,
} from "~/remotion/helpers/types";
import type { CSSProperties } from "react";

const VIDEO_FILL: CSSProperties = { width: "100%", height: "100%" };

function Picture({
  picture,
  trimBefore,
  trimAfter,
}: {
  picture: TransitionPictureProp;
  trimBefore: number;
  trimAfter: number;
}) {
  return (
    <MaskedMedia
      src={picture.src}
      maskSrc={picture.mask?.src}
      mediaKind="video"
      trimBefore={trimBefore}
      trimAfter={trimAfter}
      volume={0}
      objectFit="cover"
      style={VIDEO_FILL}
    />
  );
}

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
      <Picture picture={picture} trimBefore={frame} trimAfter={frame + 1} />
    </Freeze>
  );
}

function Playing({ picture }: { picture: TransitionPictureProp }) {
  return (
    <Picture
      picture={picture}
      trimBefore={picture.trimBefore}
      trimAfter={picture.trimAfter}
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
