import { Composition } from "remotion";

import { Cover } from "~/remotion/Cover";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_ID,
  COMPOSITION_WIDTH,
  COVER_COMPOSITION_ID,
} from "~/remotion/helpers/constants";
import { TalkingHead } from "~/remotion/TalkingHead";

import type { ProjectProps } from "~/remotion/helpers/types";
import type { TalkingHeadProps } from "~/remotion/TalkingHead";
import type { FC } from "react";
import type { CalculateMetadataFunction } from "remotion";

const defaultProps: ProjectProps = {
  title: "Untitled",
  fps: COMPOSITION_FPS,
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
  durationInFrames: COMPOSITION_FPS,
  sections: [],
  captionGroups: [],
  zooms: [],
  textOverlays: [],
  shakes: [],
  brolls: [],
  sfx: [],
  music: null,
  transitions: [],
  motionOverlays: [],
  stickers: [],
};

const calculateMetadata: CalculateMetadataFunction<TalkingHeadProps> = ({
  props,
}) => ({
  fps: props.fps || COMPOSITION_FPS,
  durationInFrames: Math.max(1, props.durationInFrames),
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
});

const calculateCoverMetadata: CalculateMetadataFunction<ProjectProps> = () => ({
  fps: COMPOSITION_FPS,
  durationInFrames: 1,
  width: COMPOSITION_WIDTH,
  height: COMPOSITION_HEIGHT,
});

export const RemotionRoot: FC = () => {
  return (
    <>
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
      <Composition
        id={COVER_COMPOSITION_ID}
        component={Cover}
        durationInFrames={1}
        fps={COMPOSITION_FPS}
        width={COMPOSITION_WIDTH}
        height={COMPOSITION_HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={calculateCoverMetadata}
      />
    </>
  );
};
