import type { FC } from "react";
import type { CalculateMetadataFunction } from "remotion";
import { Composition } from "remotion";

import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_ID,
  COMPOSITION_WIDTH,
} from "~/remotion/constants";
import { TalkingHead, type TalkingHeadProps } from "~/remotion/TalkingHead";
import type { ProjectProps } from "~/remotion/types";

const defaultProps: ProjectProps = {
  fps: COMPOSITION_FPS,
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
  durationInFrames: COMPOSITION_FPS,
  sections: [],
  captionGroups: [],
  zooms: [],
  textOverlays: [],
  listicleOverlays: [],
  shakes: [],
  brolls: [],
  sfx: [],
};

const calculateMetadata: CalculateMetadataFunction<TalkingHeadProps> = ({
  props,
}) => ({
  fps: props.fps || COMPOSITION_FPS,
  durationInFrames: Math.max(1, props.durationInFrames),
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
});

export const RemotionRoot: FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={TalkingHead}
      durationInFrames={defaultProps.durationInFrames}
      fps={COMPOSITION_FPS}
      width={COMPOSITION_WIDTH}
      height={COMPOSITION_HEIGHT}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
};
