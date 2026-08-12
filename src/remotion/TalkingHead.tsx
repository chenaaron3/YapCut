import { Video } from "@remotion/media";
import { AbsoluteFill, Series, useVideoConfig } from "remotion";

import { BRollOverlay } from "~/remotion/components/BRollOverlay";
import { Captions } from "~/remotion/components/Captions";
import { ListicleOverlay } from "~/remotion/components/ListicleOverlay";
import { SfxAudio } from "~/remotion/components/SfxAudio";
import { TextOverlay } from "~/remotion/components/TextOverlay";
import { Zoom } from "~/remotion/components/Zoom";
import { PREMOUNT_SEC } from "~/remotion/constants";

import type { ProjectProps } from "~/remotion/types";

function ArollSeries({ sections }: { sections: ProjectProps["sections"] }) {
  const { fps } = useVideoConfig();
  const premountFor = Math.round(PREMOUNT_SEC * fps);

  return (
    <Series>
      {sections.map((section, index) => (
        <Series.Sequence
          key={`${section.assetId}-${section.trimBefore}-${index}`}
          durationInFrames={section.durationInFrames}
          premountFor={premountFor}
        >
          <AbsoluteFill>
            <Video
              src={section.src}
              trimBefore={section.trimBefore}
              trimAfter={section.trimAfter}
              objectFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </AbsoluteFill>
        </Series.Sequence>
      ))}
    </Series>
  );
}

export type TalkingHeadProps = ProjectProps;

export function TalkingHead({
  sections,
  captionGroups,
  zooms,
  textOverlays,
  listicleOverlays,
  brolls,
  sfx,
}: TalkingHeadProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Zoom zooms={zooms}>
        {sections.length > 0 ? (
          <ArollSeries sections={sections} />
        ) : (
          <AbsoluteFill style={{ backgroundColor: "#111" }} />
        )}
      </Zoom>
      <BRollOverlay brolls={brolls} />
      <TextOverlay overlays={textOverlays} />
      <ListicleOverlay overlays={listicleOverlays} />
      <Captions groups={captionGroups} />
      <SfxAudio sfx={sfx} />
    </AbsoluteFill>
  );
}
