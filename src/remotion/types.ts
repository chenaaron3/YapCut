import type { TemplateStyle } from "~/domain/project-config";

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

export type ProjectProps = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  sections: ArollSection[];
  captionGroups: CaptionGroupProp[];
  zooms: ZoomProp[];
  textOverlays: TextOverlayProp[];
};
