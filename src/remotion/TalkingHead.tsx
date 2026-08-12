import { Video } from "@remotion/media";
import { AbsoluteFill, Series, useVideoConfig } from "remotion";

import { BRollOverlay } from "~/remotion/components/BRollOverlay";
import { Captions } from "~/remotion/components/Captions";
import { EnsureLocalFonts } from "~/remotion/components/EnsureLocalFonts";
import { ListicleOverlay } from "~/remotion/components/ListicleOverlay";
import { MusicOverlay } from "~/remotion/components/MusicOverlay";
import { ScreenShake } from "~/remotion/components/ScreenShake";
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
              volume={section.volume}
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
  shakes,
  brolls,
  sfx,
  music,
}: TalkingHeadProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <EnsureLocalFonts />
      <ScreenShake shakes={shakes}>
        <Zoom zooms={zooms}>
          {sections.length > 0 ? (
            <ArollSeries sections={sections} />
          ) : (
            <AbsoluteFill style={{ backgroundColor: "#111" }} />
          )}
        </Zoom>
        <BRollOverlay brolls={brolls} />
      </ScreenShake>
      <TextOverlay overlays={textOverlays} />
      <ListicleOverlay overlays={listicleOverlays} />
      <Captions groups={captionGroups} />
      <SfxAudio sfx={sfx} />
      <MusicOverlay music={music} />
    </AbsoluteFill>
  );
}
