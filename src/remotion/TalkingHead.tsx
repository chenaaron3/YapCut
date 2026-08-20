import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from "remotion";

import { partitionBehindPerson } from "~/domain/asset/mask";
import { BRollOverlay } from "~/remotion/components/BRollOverlay";
import { Captions } from "~/remotion/components/Captions";
import { EnsureLocalFonts } from "~/remotion/components/EnsureLocalFonts";
import { MotionLayer } from "~/remotion/components/motion/MotionLayer";
import { MusicOverlay } from "~/remotion/components/MusicOverlay";
import { ScreenShake } from "~/remotion/components/ScreenShake";
import { SfxAudio } from "~/remotion/components/SfxAudio";
import { StickerOverlay } from "~/remotion/components/StickerOverlay";
import { MaskedMedia } from "~/remotion/components/MaskedMedia";
import { TextOverlay } from "~/remotion/components/TextOverlay";
import { Zoom } from "~/remotion/components/Zoom";
import { PREMOUNT_SEC } from "~/remotion/helpers/constants";
import { TransitionLayer } from "~/remotion/transitions/TransitionLayer";

import type { ArollSection, ProjectProps } from "~/remotion/helpers/types";
import type { ReactNode } from "react";

const FILL = { width: "100%", height: "100%" } as const;

type ArollLayer = "original" | "occlude";

function ArollPicture({
  section,
  layer,
}: {
  section: ArollSection;
  layer: ArollLayer;
}) {
  const mask = section.mask;
  const occlude = mask?.type === "occlude";

  if (layer === "occlude") {
    if (!occlude || !mask) return null;
    return (
      <MaskedMedia
        src={section.src}
        maskSrc={mask.src}
        mediaKind="video"
        trimBefore={section.trimBefore}
        trimAfter={section.trimAfter}
        volume={0}
        objectFit="cover"
        style={FILL}
      />
    );
  }

  return (
    <MaskedMedia
      src={section.src}
      mediaKind="video"
      trimBefore={section.trimBefore}
      trimAfter={section.trimAfter}
      volume={section.volume}
      objectFit="cover"
      style={FILL}
    />
  );
}

function ArollSeries({
  sections,
  layer,
  empty = null,
}: {
  sections: ProjectProps["sections"];
  layer: ArollLayer;
  empty?: ReactNode;
}) {
  const { fps } = useVideoConfig();
  if (sections.length === 0) return empty;
  const premountFor = Math.round(PREMOUNT_SEC * fps);

  return (
    <Series>
      {sections.map((section, index) => (
        <Series.Sequence
          key={`${layer}-${section.assetId}-${section.trimBefore}-${index}`}
          durationInFrames={section.durationInFrames}
          premountFor={premountFor}
        >
          <AbsoluteFill>
            <ArollPicture section={section} layer={layer} />
          </AbsoluteFill>
        </Series.Sequence>
      ))}
    </Series>
  );
}

function arollLayerAtFrame(
  sections: readonly ArollSection[],
  frame: number,
): ArollLayer {
  let t = 0;
  for (const section of sections) {
    if (frame >= t && frame < t + section.durationInFrames) {
      return section.mask?.type === "occlude" ? "occlude" : "original";
    }
    t += section.durationInFrames;
  }
  return sections.at(-1)?.mask?.type === "occlude" ? "occlude" : "original";
}

function MaskWindow({
  sections,
  when,
  children,
}: {
  sections: readonly ArollSection[];
  when: ArollLayer;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  if (arollLayerAtFrame(sections, frame) !== when) return null;
  return <>{children}</>;
}

function ChromeOverlays({
  text,
  motion,
  stickers,
  captions,
}: {
  text: ProjectProps["textOverlays"];
  motion: ProjectProps["motionOverlays"];
  stickers: ProjectProps["stickers"];
  captions: ProjectProps["captionGroups"];
}) {
  return (
    <>
      <TextOverlay overlays={text} />
      <MotionLayer overlays={motion} />
      <StickerOverlay stickers={stickers} />
      <Captions groups={captions} />
    </>
  );
}

export type TalkingHeadProps = ProjectProps;

export function TalkingHead({
  sections,
  captionGroups,
  zooms,
  textOverlays,
  shakes,
  brolls,
  sfx,
  music,
  transitions = [],
  motionOverlays = [],
  stickers = [],
}: TalkingHeadProps) {
  const broll = partitionBehindPerson(brolls);
  const text = partitionBehindPerson(textOverlays);
  const motion = partitionBehindPerson(motionOverlays);
  const sticker = partitionBehindPerson(stickers);
  const caption = partitionBehindPerson(captionGroups);
  const chrome = (side: "behind" | "front") => ({
    text: text[side],
    motion: motion[side],
    stickers: sticker[side],
    captions: caption[side],
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <EnsureLocalFonts />
      <ScreenShake shakes={shakes}>
        <TransitionLayer transitions={transitions}>
          <Zoom zooms={zooms}>
            {/* Separate background: original → behind overlays → person plate */}
            <ArollSeries
              sections={sections}
              layer="original"
              empty={<AbsoluteFill style={{ backgroundColor: "#111" }} />}
            />
            <MaskWindow sections={sections} when="occlude">
              <BRollOverlay brolls={broll.behind} />
              <ChromeOverlays {...chrome("behind")} />
            </MaskWindow>
            <ArollSeries sections={sections} layer="occlude" />
          </Zoom>
          {/* Picture stack — stitches apply; no Zoom so punch-in doesn't scale b-roll */}
          <MaskWindow sections={sections} when="original">
            <BRollOverlay brolls={broll.behind} />
          </MaskWindow>
          <BRollOverlay brolls={broll.front} />
        </TransitionLayer>
      </ScreenShake>
      {/* Chrome outside shake/transitions so flash doesn't cover titles */}
      <MaskWindow sections={sections} when="original">
        <ChromeOverlays {...chrome("behind")} />
      </MaskWindow>
      <ChromeOverlays {...chrome("front")} />
      <SfxAudio sfx={sfx} />
      <MusicOverlay music={music} />
    </AbsoluteFill>
  );
}
