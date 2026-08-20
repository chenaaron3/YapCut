import type { ResolvedEmphasisStyle } from "~/domain/transcript/emphasis-style";
import type { ShotPlan } from "~/domain/vfx/motion-config";
import type { ScribbleId } from "~/domain/transcript/scribble";
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
  scribble?: ScribbleId;
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
  /** Null = both lines from start (stacked) or heading-only. */
  middleFrame: number | null;
  heading: string;
  subheading: string;
  headingStyle: CaptionGroupStyle;
  subheadingStyle: CaptionGroupStyle;
  stacked: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
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

export type TransitionPictureProp = {
  src: string;
  trimBefore: number;
  trimAfter: number;
  /** Source frame to hold when the keep picture runs out. */
  freezeFrame: number;
};

export type TransitionClipProp = {
  id: number;
  templateId: "flash" | "flashZoom" | "slide";
  startFrame: number;
  endFrame: number;
  /** Output frame of the keep join (opening = start, closing = end). */
  stitchFrame: number;
  mode: "opening" | "closing" | "interior";
  out?: TransitionPictureProp;
  in?: TransitionPictureProp;
};

export type MotionStillProp = {
  src: string;
  width: number | null;
  height: number | null;
};

export type MotionOverlayProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  plan: ShotPlan;
  style: CaptionGroupStyle;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  media: MotionStillProp | null;
};

export type StickerClipProp = {
  id: number;
  startFrame: number;
  endFrame: number;
  source: "emoji" | "lordicon";
  catalogId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
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
  shakes: ShakeClipProp[];
  brolls: BrollClipProp[];
  sfx: SfxClipProp[];
  music?: MusicClipProp | null;
  transitions: TransitionClipProp[];
  motionOverlays: MotionOverlayProp[];
  stickers: StickerClipProp[];
};
