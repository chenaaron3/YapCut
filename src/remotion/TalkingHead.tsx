import { AbsoluteFill, Series } from "remotion";
import { Video } from "@remotion/media";

import { BRollOverlay } from "~/remotion/components/BRollOverlay";
import { Captions } from "~/remotion/components/Captions";
import { TextOverlay } from "~/remotion/components/TextOverlay";
import { Zoom } from "~/remotion/components/Zoom";
import type { ProjectProps } from "~/remotion/types";

function ArollSeries({ sections }: { sections: ProjectProps["sections"] }) {
  return (
    <Series>
      {sections.map((section, index) => (
        <Series.Sequence
          key={`${section.assetId}-${section.trimBefore}-${index}`}
          durationInFrames={section.durationInFrames}
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
  brolls,
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
      <Captions groups={captionGroups} />
    </AbsoluteFill>
  );
}
