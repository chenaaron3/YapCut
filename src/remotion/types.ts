import type { ResolvedEmphasisStyle } from "~/domain/emphasis-style";
import type { TemplateStyle } from "~/domain/project-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";

export type ArollSection = {
  assetId: string;
  src: string;
  /** Local media trim (frames). */
  trimBefore: number;
  trimAfter: number;
  durationInFrames: number;
  /** Peak-limited gain to voice target LUFS. */
  volume: number;
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
  /** Resolved emphasis paint for `emphasized` words (captions/quotes). */
  emphasisStyle?: ResolvedEmphasisStyle;
};

export type ZoomProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  /** End-keyframe transform (start is always identity). */
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  /** Ease identity → end over the range; false = hard snap. */
  ease: boolean;
};

export type TextOverlayProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  text: string;
  style?: TemplateStyle;
};

/** Baked listicle overlay (timing via middleFrame; layout via stacked). */
export type ListicleOverlayProp = {
  id: number;
  startFrame: number;
  /** Null = not staggered. */
  middleFrame: number | null;
  endFrame: number;
  indicatorText: string;
  valueText: string;
  indicatorStyle: CaptionGroupStyle;
  valueStyle: CaptionGroupStyle;
  /** Template: stack indicator above value when both visible. */
  stacked: boolean;
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

export type MusicClipProp = {
  src: string;
  /** Mix × library-normalize gain (may be >1). */
  volume: number;
  mediaOffsetSec: number;
};

/** Baked camera-shake clip (intensity = fraction of composition size). */
export type ShakeClipProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  intensity: number;
};

export type ProjectProps = {
  /** Project.title at props time (Cover still; TalkingHead ignores). */
  title: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  sections: ArollSection[];
  captionGroups: CaptionGroupProp[];
  zooms: ZoomProp[];
  textOverlays: TextOverlayProp[];
  listicleOverlays: ListicleOverlayProp[];
  shakes: ShakeClipProp[];
  brolls: BrollClipProp[];
  sfx: SfxClipProp[];
  music?: MusicClipProp | null;
};
