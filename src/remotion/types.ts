import type { TemplateStyle } from "~/domain/project-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export type ArollSection = {
  assetId: string;
  src: string;
  /** Local media trim (frames). */
  trimBefore: number;
  trimAfter: number;
  durationInFrames: number;
};

export type CaptionWordProp = {
  text: string;
  startFrame: number;
  endFrame: number;
  emphasized?: boolean;
};

export type CaptionGroupProp = {
  words: CaptionWordProp[];
  startFrame: number;
  endFrame: number;
  captionsAtATime: number;
  /** Fully resolved style baked at props time. */
  style?: CaptionGroupStyle;
};

export type ZoomProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  scale: number;
};

export type TextOverlayProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  text: string;
  style?: TemplateStyle;
};

export type BrollClipProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  src: string;
  width: number;
  height: number;
  /** `image` | `video` — drives Img vs Video. */
  mediaKind: "image" | "video";
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  kenBurns?: number;
  mediaOffsetSec: number;
  volume: number;
};

export type SfxClipProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  src: string;
  mediaOffsetSec: number;
  volume: number;
};

export type ProjectProps = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  sections: ArollSection[];
  captionGroups: CaptionGroupProp[];
  zooms: ZoomProp[];
  textOverlays: TextOverlayProp[];
  brolls: BrollClipProp[];
  sfx: SfxClipProp[];
};
