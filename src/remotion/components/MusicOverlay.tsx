import { useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

import { musicFadeAtFrame } from "~/domain/audio/music";
import type { MusicClipProp } from "~/remotion/helpers/types";

export function MusicOverlay({
  music,
}: {
  music?: MusicClipProp | null;
}) {
  const { fps, durationInFrames } = useVideoConfig();
  if (!music || music.volume <= 0) return null;

  const trimBefore =
    music.mediaOffsetSec > 0
      ? Math.round(music.mediaOffsetSec * fps)
      : undefined;

  return (
    <Audio
      src={music.src}
      loop
      loopVolumeCurveBehavior="extend"
      trimBefore={trimBefore}
      volume={(frame) =>
        music.volume *
        musicFadeAtFrame({ frame, durationInFrames, fps })
      }
    />
  );
}
