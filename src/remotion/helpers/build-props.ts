import {
  arollPlaybackMask,
  behindPersonProp,
  maskProp,
} from "~/domain/asset/mask";
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
import type { MaskEntry } from "~/domain/asset/mask";
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

/** Per-asset lookup for props (playback, size, loudness, mask). Absent mask = Off. */
export type PropsAsset = {
  src: string;
  kind: "video" | "image" | "audio";
  durationSec: number | null;
  width: number | null;
  height: number | null;
  lufs: number | null;
  truePeakDb: number | null;
  mask?: MaskEntry;
};

type Assets = ReadonlyMap<string, PropsAsset>;

export type BuildProjectPropsInput = {
  config: ProjectConfig;
  /** Display title for Cover (and future on-export metadata). */
  title?: string;
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>;
  assets: Assets;
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

function durationSecById(assets: Assets): Map<string, number> {
  const map = new Map<string, number>();
  for (const [id, asset] of assets) {
    map.set(id, asset.durationSec ?? 0);
  }
  return map;
}

function loudnessOf(asset: PropsAsset | undefined): {
  lufs: number | null;
  truePeakDb: number | null;
} {
  return { lufs: asset?.lufs ?? null, truePeakDb: asset?.truePeakDb ?? null };
}

function buildSections(
  arolls: readonly ArollKeep[],
  assets: Assets,
  fps: number,
): ArollSection[] {
  return arolls.map((keep) => {
    const asset = assets.get(keep.assetId);
    const trimBefore = secToFrame(keep.start, fps);
    const assetEnd = asset?.durationSec
      ? Math.max(trimBefore + 1, Math.floor(asset.durationSec * fps))
      : Number.POSITIVE_INFINITY;
    const trimAfter = Math.min(secToFrame(keep.end, fps), assetEnd);
    const durationInFrames = Math.max(1, trimAfter - trimBefore);
    const loud = loudnessOf(asset);
    return {
      assetId: keep.assetId,
      src: asset?.src ?? "",
      trimBefore,
      trimAfter,
      durationInFrames,
      volume: arollPlaybackGain(loud.lufs, loud.truePeakDb),
      ...maskProp(arollPlaybackMask(asset?.mask)),
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
  behindPerson?: boolean;
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
      ...behindPersonProp(e),
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
    behindPerson?: boolean;
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
      behindPerson: quote?.behindPerson === true,
    });
  }

  const styleByKey = new Map<string, CaptionGroupStyle>();
  const emphasisByKey = new Map<string, ResolvedEmphasisStyle>();
  const behindByKey = new Map<string, boolean>();
  for (const word of styledWords) {
    styleByKey.set(word.styleKey, word.style);
    emphasisByKey.set(word.styleKey, word.emphasisStyle);
    if (word.behindPerson) behindByKey.set(word.styleKey, true);
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
        ...(behindByKey.get(group.styleKey) ? { behindPerson: true } : {}),
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
      ...behindPersonProp(e),
    });
  }
  return out;
}

function buildBrolls(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  assets: Assets,
  fps: number,
): BrollClipProp[] {
  const out: BrollClipProp[] = [];
  for (const e of edits) {
    if (e.kind !== "broll") continue;
    const asset = assets.get(e.assetId);
    if (!asset?.src) continue;
    if (
      asset.width == null ||
      asset.height == null ||
      asset.width <= 0 ||
      asset.height <= 0
    ) {
      continue;
    }
    if (asset.kind !== "image" && asset.kind !== "video") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      src: asset.src,
      width: asset.width,
      height: asset.height,
      mediaKind: asset.kind,
      scale: e.scale,
      offsetX: e.offsetX,
      offsetY: e.offsetY,
      rotation: e.rotation,
      mediaOffsetSec: e.mediaOffsetSec,
      volume: e.volume,
      ...(e.kenBurns != null ? { kenBurns: e.kenBurns } : {}),
      ...maskProp(asset.mask?.type === "cutout" ? asset.mask : undefined),
      ...behindPersonProp(e),
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
  assets: Assets,
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
      const asset = assets.get(ref.assetId);
      if (asset?.src) {
        media = {
          src: asset.src,
          width: asset.width,
          height: asset.height,
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
      ...behindPersonProp(e),
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
      ...behindPersonProp(e),
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
    assets: Assets;
    fps: number;
  },
): void {
  const asset = args.assets.get(args.assetId);
  if (!asset?.src || asset.kind !== "audio") return;
  const range = timelineRangeToOutput(args.cells, {
    start: args.start,
    end: args.end,
  });
  if (!range) return;
  const loud = loudnessOf(asset);
  out.push({
    id: args.id,
    startFrame: secToFrame(range.start, args.fps),
    endFrame: Math.max(
      secToFrame(range.start, args.fps) + 1,
      secToFrame(range.end, args.fps),
    ),
    src: asset.src,
    mediaOffsetSec: args.mediaOffsetSec,
    volume: sfxPlaybackVolume(args.volume, loud.lufs, loud.truePeakDb),
  });
}

function companionPlayEnd(
  start: number,
  mediaOffsetSec: number,
  srcDurationSec: number | null | undefined,
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
  assets: Assets,
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
        assets,
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
        assets.get(companion.assetId)?.durationSec,
      ),
      assetId: companion.assetId,
      mediaOffsetSec: companion.mediaOffsetSec,
      volume: companion.volume,
      cells,
      assets,
      fps,
    });
  }
  return out;
}

function buildMusic(
  music: ProjectConfig["music"],
  assets: Assets,
): MusicClipProp | null {
  if (!music) return null;
  const asset = assets.get(music.assetId);
  if (!asset?.src || asset.kind !== "audio") return null;
  const loud = loudnessOf(asset);
  return {
    src: asset.src,
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
  assets: Assets,
  fps: number,
): TransitionPictureProp | undefined {
  const asset = assets.get(keep.local.assetId);
  const src = asset?.src;
  if (!src) return undefined;
  const trimStart = secToFrame(keep.local.start, fps);
  const trimEnd = Math.max(trimStart + 1, secToFrame(keep.local.end, fps));
  const at = secToFrame(localSecInKeep(keep, timelineSec), fps);
  const mask = maskProp(arollPlaybackMask(asset?.mask));
  if (side === "out") {
    return {
      src,
      trimBefore: at,
      trimAfter: trimEnd,
      freezeFrame: Math.max(trimStart, trimEnd - 1),
      ...mask,
    };
  }
  return {
    src,
    trimBefore: trimStart,
    trimAfter: Math.max(trimStart + 1, at),
    freezeFrame: trimStart,
    ...mask,
  };
}

function buildTransitions(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  assets: Assets,
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
        ? { out: stitchPicture(pair.outKeep, e.start, "out", assets, fps) }
        : {}),
      ...(kind !== "closing"
        ? { in: stitchPicture(pair.inKeep, e.end, "in", assets, fps) }
        : {}),
    });
  }
  return out;
}

export function buildProjectProps(input: BuildProjectPropsInput): ProjectProps {
  const fps = input.fps ?? COMPOSITION_FPS ?? PROJECT_FPS;
  const sections = buildSections(
    input.config.arolls,
    input.assets,
    fps,
  ).filter((s) => s.src.length > 0);

  const layout = buildArollLayout(
    input.config.arolls,
    durationSecById(input.assets),
  );
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
    brolls: buildBrolls(input.config.edits, layout, input.assets, fps),
    sfx: buildSfx(input.config.edits, layout, input.assets, fps),
    music: buildMusic(input.config.music, input.assets),
    transitions: buildTransitions(
      input.config.edits,
      layout,
      input.assets,
      fps,
    ),
    motionOverlays: buildMotionOverlays(
      input.config.edits,
      layout,
      input.assets,
      fps,
    ),
    stickers: buildStickers(input.config.edits, layout, fps),
  };
}
