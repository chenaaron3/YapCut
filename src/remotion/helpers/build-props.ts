import { buildArollLayout } from "~/domain/aroll/arolls";
import {
  arollPlaybackGain,
  mixPlaybackVolume,
  MUSIC_VOLUME_DEFAULT,
  sfxPlaybackVolume,
} from "~/domain/audio/mix-levels";
import { pickEmphasisStyle } from "~/domain/transcript/emphasis-style";
import {
  outputDurationFromArolls,
  timelineRangeToOutput,
} from "~/domain/aroll/layout-time";
import { isMotionEdit } from "~/domain/vfx/motion";
import { motionMediaRef } from "~/domain/vfx/motion-config";
import {
  editHidesCaptions,
  isTextBaseEdit,
  PROJECT_FPS,
} from "~/domain/project/project-config";
import { projectOutputWords } from "~/domain/aroll/projection";
import { scribbleWordFields } from "~/domain/transcript/scribble";
import { resolveShakeIntensity } from "~/domain/vfx/shake";
import { isStickerEdit } from "~/domain/edit/sticker";
import { resolveTransform } from "~/domain/edit/transform";
import { keepsForStitch } from "~/domain/edit/transition";
import { editMiddleSec } from "~/domain/edit/vfx";
import { DEFAULT_ZOOM_SCALE, resolveZoomEase } from "~/domain/edit/zoom";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import { applyCaptionOverrides } from "~/remotion/captions/style";
import {
  groupStyledCaptionWords,
  isFiller,
  padLastWordInGroups,
  stripPunctuationForDisplay,
} from "~/remotion/captions/words";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
} from "~/remotion/templates/caption";
import { resolveOverlayForEdit } from "~/remotion/templates/overlay";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  resolveQuoteTemplateStyle,
} from "~/remotion/templates/quote";
import { resolveTemplateStyle } from "~/remotion/templates/style";

import type { ArollLayoutCell } from "~/domain/aroll/arolls";
import type {
  EmphasisStyle,
  ResolvedEmphasisStyle,
} from "~/domain/transcript/emphasis-style";
import type { ArollKeep, ProjectConfig } from "~/domain/project/project-config";
import type { OutputTime } from "~/domain/media/time";
import type { TranscriptWord } from "~/domain/transcript/transcript";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type {
  ArollSection,
  BrollClipProp,
  CaptionGroupProp,
  CaptionWordProp,
  MotionOverlayProp,
  MusicClipProp,
  ProjectProps,
  SfxClipProp,
  ShakeClipProp,
  StickerClipProp,
  TextOverlayProp,
  TransitionClipProp,
  TransitionPictureProp,
  ZoomProp,
} from "~/remotion/helpers/types";

export type BuildProjectPropsInput = {
  config: ProjectConfig;
  /** Display title for Cover (and future on-export metadata). */
  title?: string;
  /** assetId → signed playback URL */
  mediaUrls: ReadonlyMap<string, string>;
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>;
  /** assetId → media duration (for timeline→output edit mapping). */
  assetDurationSec: ReadonlyMap<string, number>;
  /** assetId → natural size for b-roll contain-fit. */
  assetSize: ReadonlyMap<string, { width: number; height: number }>;
  /** assetId → media kind (image|video|audio). */
  assetKind: ReadonlyMap<string, "video" | "image" | "audio">;
  /** assetId → measured loudness (missing → gain 1). */
  assetLoudness?: ReadonlyMap<
    string,
    { lufs: number | null; truePeakDb: number | null }
  >;
  fps?: number;
};

function secToFrame(sec: number, fps: number): number {
  return Math.max(0, Math.round(sec * fps));
}

function outputMiddleFrame(
  editStart: number,
  editEnd: number,
  middle: number | null | undefined,
  rangeStart: number,
  rangeEnd: number,
  startFrame: number,
  endFrame: number,
  fps: number,
): number | null {
  if (middle == null) return null;
  const span = Math.max(0.001, editEnd - editStart);
  const t = Math.min(1, Math.max(0, (middle - editStart) / span));
  const middleSec = rangeStart + t * (rangeEnd - rangeStart);
  return Math.min(endFrame, Math.max(startFrame, secToFrame(middleSec, fps)));
}

function loudnessOf(
  assetLoudness:
    | ReadonlyMap<string, { lufs: number | null; truePeakDb: number | null }>
    | undefined,
  assetId: string,
): { lufs: number | null; truePeakDb: number | null } {
  return assetLoudness?.get(assetId) ?? { lufs: null, truePeakDb: null };
}

function buildSections(
  arolls: readonly ArollKeep[],
  mediaUrls: ReadonlyMap<string, string>,
  assetLoudness:
    | ReadonlyMap<string, { lufs: number | null; truePeakDb: number | null }>
    | undefined,
  fps: number,
): ArollSection[] {
  return arolls.map((keep) => {
    const trimBefore = secToFrame(keep.start, fps);
    const trimAfter = secToFrame(keep.end, fps);
    const durationInFrames = Math.max(1, trimAfter - trimBefore);
    const loud = loudnessOf(assetLoudness, keep.assetId);
    return {
      assetId: keep.assetId,
      src: mediaUrls.get(keep.assetId) ?? "",
      trimBefore,
      trimAfter,
      durationInFrames,
      volume: arollPlaybackGain(loud.lufs, loud.truePeakDb),
    };
  });
}

export function resolveProjectCaptionStyle(
  captions: ProjectConfig["captions"],
): CaptionGroupStyle {
  const templateId = isCaptionTemplateId(captions.templateId)
    ? captions.templateId
    : DEFAULT_CAPTION_TEMPLATE_ID;
  const base = resolveCaptionTemplateStyle(templateId);
  return applyCaptionOverrides(
    base,
    normalizeCaptionOverrides(captions.overrides),
  );
}

type OutputQuote = {
  id: number;
  start: number;
  end: number;
  style: CaptionGroupStyle;
  emphasisStyle?: EmphasisStyle;
};

function outputQuotes(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
): OutputQuote[] {
  const out: OutputQuote[] = [];
  for (const e of edits) {
    if (e.kind !== "vfx" || e.type !== "quote") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    out.push({
      id: e.id,
      start: range.start,
      end: range.end,
      style: resolveTemplateStyle(
        e.style,
        isQuoteTemplateId,
        DEFAULT_QUOTE_TEMPLATE_ID,
        resolveQuoteTemplateStyle,
      ),
      emphasisStyle: e.emphasisStyle,
    });
  }
  return out;
}

/** First quote whose output range overlaps the word (start inclusive, end exclusive). */
function quoteForWord(
  word: { start: number; end: number },
  quotes: readonly OutputQuote[],
): OutputQuote | null {
  for (const quote of quotes) {
    if (word.start < quote.end && word.end > quote.start) return quote;
  }
  return null;
}

/** Output-time ranges for any edit with `hideCaptions: true`. */
function hiddenCaptionRanges(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
): OutputTime[] {
  const ranges: OutputTime[] = [];
  for (const e of edits) {
    if (!editHidesCaptions(e)) continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    ranges.push(range);
  }
  return ranges;
}

function wordInHiddenRange(
  word: { start: number; end: number },
  ranges: readonly OutputTime[],
): boolean {
  for (const range of ranges) {
    if (word.start < range.end && word.end > range.start) return true;
  }
  return false;
}

function buildCaptionGroups(
  config: ProjectConfig,
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>,
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): CaptionGroupProp[] {
  const captionStyle = resolveProjectCaptionStyle(config.captions);
  const projectEmphasis = config.emphasisStyle;
  const defaultEmphasis = pickEmphasisStyle(projectEmphasis);
  const quotes = outputQuotes(config.edits, cells);
  const hiddenRanges = hiddenCaptionRanges(config.edits, cells);
  const words = projectOutputWords(config.arolls, transcriptsByAssetId);

  type StyledWord = CaptionWordProp & {
    styleKey: string;
    segmentKey: string;
    captionsAtATime: number;
    style: CaptionGroupStyle;
    emphasisStyle: ResolvedEmphasisStyle;
  };

  // Keep source punctuation through grouping so sentence boundaries work;
  // strip for on-screen display after groups are formed.
  // Bump `segment` across hidden runs so a caption group never spans a hide.
  const styledWords: StyledWord[] = [];
  let segment = 0;
  for (const word of words) {
    if (isFiller(word.text) || !word.text.trim()) continue;
    if (wordInHiddenRange(word, hiddenRanges)) {
      segment += 1;
      continue;
    }
    const startFrame = secToFrame(word.start, fps);
    const endFrame = Math.max(startFrame + 3, secToFrame(word.end, fps));
    const quote = quoteForWord(word, quotes);
    const style = quote?.style ?? captionStyle;
    const emphasisStyle = pickEmphasisStyle(
      projectEmphasis,
      quote?.emphasisStyle,
    );
    styledWords.push({
      text: word.text,
      startFrame,
      endFrame,
      ...scribbleWordFields(word),
      styleKey: quote ? `quote:${quote.id}` : "default",
      segmentKey: String(segment),
      captionsAtATime: style.captionsAtATime,
      style,
      emphasisStyle,
    });
  }

  const styleByKey = new Map<string, CaptionGroupStyle>();
  const emphasisByKey = new Map<string, ResolvedEmphasisStyle>();
  for (const word of styledWords) {
    styleByKey.set(word.styleKey, word.style);
    emphasisByKey.set(word.styleKey, word.emphasisStyle);
  }

  const displayGroups = groupStyledCaptionWords(styledWords)
    .map((group) => {
      const displayWords = group.words
        .map((w) => ({
          ...w,
          text: stripPunctuationForDisplay(w.text),
        }))
        .filter((w) => w.text.length > 0);
      if (displayWords.length === 0) return null;
      const style = styleByKey.get(group.styleKey) ?? captionStyle;
      const emphasisStyle =
        emphasisByKey.get(group.styleKey) ?? defaultEmphasis;
      return {
        words: displayWords,
        startFrame: displayWords[0]!.startFrame,
        endFrame: displayWords[displayWords.length - 1]!.endFrame,
        captionsAtATime: style.captionsAtATime,
        style,
        emphasisStyle,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g != null);

  return padLastWordInGroups(displayGroups, fps);
}

function buildZooms(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): ZoomProp[] {
  const out: ZoomProp[] = [];
  for (const e of edits) {
    if (e.kind !== "zoom") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    const t = resolveTransform({
      scale: e.scale ?? DEFAULT_ZOOM_SCALE,
      offsetX: e.offsetX,
      offsetY: e.offsetY,
      rotation: e.rotation,
    });
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      scale: t.scale,
      offsetX: t.offsetX,
      offsetY: t.offsetY,
      rotation: t.rotation,
      ease: resolveZoomEase(e.ease),
    });
  }
  return out;
}

function buildTextOverlays(
  config: ProjectConfig,
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): TextOverlayProp[] {
  const out: TextOverlayProp[] = [];
  for (const e of config.edits) {
    if (!isTextBaseEdit(e)) continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    const startFrame = secToFrame(range.start, fps);
    const endFrame = Math.max(startFrame + 1, secToFrame(range.end, fps));
    const look = resolveOverlayForEdit(e);
    const t = resolveTransform(e);
    out.push({
      id: e.id,
      startFrame,
      endFrame,
      middleFrame: outputMiddleFrame(
        e.start,
        e.end,
        editMiddleSec(e, look.stacked),
        range.start,
        range.end,
        startFrame,
        endFrame,
        fps,
      ),
      heading: e.heading,
      subheading: e.subheading,
      headingStyle: look.heading,
      subheadingStyle: look.subheading,
      stacked: look.stacked,
      scale: t.scale,
      offsetX: t.offsetX,
      offsetY: t.offsetY,
      rotation: t.rotation,
    });
  }
  return out;
}

function buildBrolls(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  mediaUrls: ReadonlyMap<string, string>,
  assetSize: ReadonlyMap<string, { width: number; height: number }>,
  assetKind: ReadonlyMap<string, "video" | "image" | "audio">,
  fps: number,
): BrollClipProp[] {
  const out: BrollClipProp[] = [];
  for (const e of edits) {
    if (e.kind !== "broll") continue;
    const src = mediaUrls.get(e.assetId);
    if (!src) continue;
    const size = assetSize.get(e.assetId);
    if (!size || size.width <= 0 || size.height <= 0) continue;
    const kind = assetKind.get(e.assetId);
    if (kind !== "image" && kind !== "video") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      src,
      width: size.width,
      height: size.height,
      mediaKind: kind,
      scale: e.scale,
      offsetX: e.offsetX,
      offsetY: e.offsetY,
      rotation: e.rotation,
      mediaOffsetSec: e.mediaOffsetSec,
      volume: e.volume,
      ...(e.kenBurns != null ? { kenBurns: e.kenBurns } : {}),
    });
  }
  return out;
}

function buildShakes(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): ShakeClipProp[] {
  const out: ShakeClipProp[] = [];
  for (const e of edits) {
    if (e.kind !== "vfx" || e.type !== "shake") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      intensity: resolveShakeIntensity(e.intensity),
    });
  }
  return out;
}

function buildMotionOverlays(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  mediaUrls: ReadonlyMap<string, string>,
  assetSize: ReadonlyMap<string, { width: number; height: number }>,
  fps: number,
): MotionOverlayProp[] {
  const out: MotionOverlayProp[] = [];
  for (const e of edits) {
    if (!isMotionEdit(e) || e.plan == null) continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    const pose = resolveTransform(e);
    const style = resolveTemplateStyle(
      e.style,
      isCaptionTemplateId,
      DEFAULT_CAPTION_TEMPLATE_ID,
      resolveCaptionTemplateStyle,
    );
    const ref = motionMediaRef(e.plan);
    let media: MotionOverlayProp["media"] = null;
    if (ref) {
      const src = mediaUrls.get(ref.assetId);
      if (src) {
        const size = assetSize.get(ref.assetId);
        media = {
          src,
          width: size?.width ?? null,
          height: size?.height ?? null,
        };
      }
    }
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      plan: e.plan,
      style,
      scale: pose.scale,
      offsetX: pose.offsetX,
      offsetY: pose.offsetY,
      rotation: pose.rotation,
      media,
    });
  }
  return out;
}

function buildStickers(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): StickerClipProp[] {
  const out: StickerClipProp[] = [];
  for (const e of edits) {
    if (!isStickerEdit(e)) continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    const pose = resolveTransform(e);
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      source: e.source,
      catalogId: e.catalogId,
      scale: pose.scale,
      offsetX: pose.offsetX,
      offsetY: pose.offsetY,
      rotation: pose.rotation,
    });
  }
  return out;
}

const COMPANION_SFX_FALLBACK_SEC = 0.35;

function pushSfxClip(
  out: SfxClipProp[],
  args: {
    id: number;
    start: number;
    end: number;
    assetId: string;
    mediaOffsetSec: number;
    volume: number;
    cells: ReturnType<typeof buildArollLayout>;
    mediaUrls: ReadonlyMap<string, string>;
    assetKind: ReadonlyMap<string, "video" | "image" | "audio">;
    assetLoudness:
      | ReadonlyMap<string, { lufs: number | null; truePeakDb: number | null }>
      | undefined;
    fps: number;
  },
): void {
  const src = args.mediaUrls.get(args.assetId);
  if (!src) return;
  if (args.assetKind.get(args.assetId) !== "audio") return;
  const range = timelineRangeToOutput(args.cells, {
    start: args.start,
    end: args.end,
  });
  if (!range) return;
  const loud = loudnessOf(args.assetLoudness, args.assetId);
  out.push({
    id: args.id,
    startFrame: secToFrame(range.start, args.fps),
    endFrame: Math.max(
      secToFrame(range.start, args.fps) + 1,
      secToFrame(range.end, args.fps),
    ),
    src,
    mediaOffsetSec: args.mediaOffsetSec,
    volume: sfxPlaybackVolume(args.volume, loud.lufs, loud.truePeakDb),
  });
}

function companionPlayEnd(
  start: number,
  mediaOffsetSec: number,
  srcDurationSec: number | undefined,
): number {
  const play =
    srcDurationSec != null && srcDurationSec > 0
      ? Math.max(0.05, srcDurationSec - mediaOffsetSec)
      : COMPANION_SFX_FALLBACK_SEC;
  return start + play;
}

function buildSfx(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  mediaUrls: ReadonlyMap<string, string>,
  assetKind: ReadonlyMap<string, "video" | "image" | "audio">,
  assetLoudness:
    | ReadonlyMap<string, { lufs: number | null; truePeakDb: number | null }>
    | undefined,
  assetDurationSec: ReadonlyMap<string, number>,
  fps: number,
): SfxClipProp[] {
  const out: SfxClipProp[] = [];
  for (const e of edits) {
    if (e.kind === "sfx") {
      pushSfxClip(out, {
        id: e.id,
        start: e.start,
        end: e.end,
        assetId: e.assetId,
        mediaOffsetSec: e.mediaOffsetSec,
        volume: e.volume,
        cells,
        mediaUrls,
        assetKind,
        assetLoudness,
        fps,
      });
      continue;
    }
    const companion = e.companionSfx;
    if (!companion) continue;
    pushSfxClip(out, {
      id: e.id,
      start: e.start,
      end: companionPlayEnd(
        e.start,
        companion.mediaOffsetSec,
        assetDurationSec.get(companion.assetId),
      ),
      assetId: companion.assetId,
      mediaOffsetSec: companion.mediaOffsetSec,
      volume: companion.volume,
      cells,
      mediaUrls,
      assetKind,
      assetLoudness,
      fps,
    });
  }
  return out;
}

function buildMusic(
  music: ProjectConfig["music"],
  mediaUrls: ReadonlyMap<string, string>,
  assetKind: ReadonlyMap<string, "video" | "image" | "audio">,
  assetLoudness:
    | ReadonlyMap<string, { lufs: number | null; truePeakDb: number | null }>
    | undefined,
): MusicClipProp | null {
  if (!music) return null;
  const src = mediaUrls.get(music.assetId);
  if (!src) return null;
  if (assetKind.get(music.assetId) !== "audio") return null;
  const loud = loudnessOf(assetLoudness, music.assetId);
  return {
    src,
    volume: mixPlaybackVolume(
      music.volume,
      loud.lufs,
      loud.truePeakDb,
      MUSIC_VOLUME_DEFAULT,
    ),
    mediaOffsetSec: music.mediaOffsetSec,
  };
}

function localSecInKeep(keep: ArollLayoutCell, timelineSec: number): number {
  const t = Math.min(
    keep.timeline.end,
    Math.max(keep.timeline.start, timelineSec),
  );
  return keep.local.start + (t - keep.timeline.start);
}

function stitchPicture(
  keep: ArollLayoutCell,
  timelineSec: number,
  side: "out" | "in",
  mediaUrls: ReadonlyMap<string, string>,
  fps: number,
): TransitionPictureProp | undefined {
  const src = mediaUrls.get(keep.local.assetId);
  if (!src) return undefined;
  const trimStart = secToFrame(keep.local.start, fps);
  const trimEnd = Math.max(trimStart + 1, secToFrame(keep.local.end, fps));
  const at = secToFrame(localSecInKeep(keep, timelineSec), fps);
  if (side === "out") {
    return {
      src,
      trimBefore: at,
      trimAfter: trimEnd,
      freezeFrame: Math.max(trimStart, trimEnd - 1),
    };
  }
  return {
    src,
    trimBefore: trimStart,
    trimAfter: Math.max(trimStart + 1, at),
    freezeFrame: trimStart,
  };
}

function buildTransitions(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  mediaUrls: ReadonlyMap<string, string>,
  fps: number,
): TransitionClipProp[] {
  const out: TransitionClipProp[] = [];
  for (const e of edits) {
    if (e.kind !== "transition") continue;
    const pair = keepsForStitch(e.stitch, cells);
    if (!pair) continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    const startFrame = secToFrame(range.start, fps);
    const endFrame = Math.max(startFrame + 1, secToFrame(range.end, fps));
    const kind = e.stitch.kind;
    const stitchFrame =
      kind === "opening"
        ? startFrame
        : kind === "closing"
          ? endFrame
          : secToFrame(pair.outKeep.output.end, fps);

    out.push({
      id: e.id,
      templateId: e.templateId,
      startFrame,
      endFrame,
      stitchFrame,
      mode: kind,
      ...(kind !== "opening"
        ? { out: stitchPicture(pair.outKeep, e.start, "out", mediaUrls, fps) }
        : {}),
      ...(kind !== "closing"
        ? { in: stitchPicture(pair.inKeep, e.end, "in", mediaUrls, fps) }
        : {}),
    });
  }
  return out;
}

export function buildProjectProps(input: BuildProjectPropsInput): ProjectProps {
  const fps = input.fps ?? COMPOSITION_FPS ?? PROJECT_FPS;
  const sections = buildSections(
    input.config.arolls,
    input.mediaUrls,
    input.assetLoudness,
    fps,
  ).filter((s) => s.src.length > 0);

  const layout = buildArollLayout(input.config.arolls, input.assetDurationSec);
  const durationSec = outputDurationFromArolls(input.config.arolls);
  const durationInFrames = Math.max(1, secToFrame(durationSec, fps));

  return {
    title: input.title?.trim() || "Untitled",
    fps,
    width: COMPOSITION_WIDTH,
    height: COMPOSITION_HEIGHT,
    durationInFrames,
    sections,
    captionGroups: buildCaptionGroups(
      input.config,
      input.transcriptsByAssetId,
      layout,
      fps,
    ),
    zooms: buildZooms(input.config.edits, layout, fps),
    textOverlays: buildTextOverlays(input.config, layout, fps),
    shakes: buildShakes(input.config.edits, layout, fps),
    brolls: buildBrolls(
      input.config.edits,
      layout,
      input.mediaUrls,
      input.assetSize,
      input.assetKind,
      fps,
    ),
    sfx: buildSfx(
      input.config.edits,
      layout,
      input.mediaUrls,
      input.assetKind,
      input.assetLoudness,
      input.assetDurationSec,
      fps,
    ),
    music: buildMusic(
      input.config.music,
      input.mediaUrls,
      input.assetKind,
      input.assetLoudness,
    ),
    transitions: buildTransitions(
      input.config.edits,
      layout,
      input.mediaUrls,
      fps,
    ),
    motionOverlays: buildMotionOverlays(
      input.config.edits,
      layout,
      input.mediaUrls,
      input.assetSize,
      fps,
    ),
    stickers: buildStickers(input.config.edits, layout, fps),
  };
}
