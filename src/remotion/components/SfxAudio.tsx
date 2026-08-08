import { Sequence, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

import type { SfxClipProp } from "~/remotion/types";

function SfxClip({ clip }: { clip: SfxClipProp }) {
  const { fps } = useVideoConfig();
  const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
  const trimBefore = Math.round(clip.mediaOffsetSec * fps);

  return (
    <Sequence from={clip.startFrame} durationInFrames={durationInFrames}>
      <Audio src={clip.src} volume={clip.volume} trimBefore={trimBefore} />
    </Sequence>
  );
}

export function SfxAudio({ sfx }: { sfx?: SfxClipProp[] | null }) {
  if (!sfx?.length) return null;

  return (
    <>
      {sfx.map((clip) => (
        <SfxClip key={clip.id} clip={clip} />
      ))}
    </>
  );
}
