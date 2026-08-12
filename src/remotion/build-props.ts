import { buildArollLayout, timelineRangeToOutput } from "~/domain/arolls";
import {
  editHidesCaptions,
  outputDurationFromArolls,
  PROJECT_FPS,
} from "~/domain/project-config";
import { projectOutputWords } from "~/domain/projection";
import { resolveShakeIntensity } from "~/domain/shake";
import { resolveTransform } from "~/domain/transform";
import { DEFAULT_ZOOM_SCALE, resolveZoomEase } from "~/domain/zoom";
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
} from "~/remotion/constants";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
} from "~/remotion/templates/caption";
import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  isListicleTemplateId,
  resolveListicleTextStyles,
} from "~/remotion/templates/listicle";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  resolveQuoteTemplateStyle,
} from "~/remotion/templates/quote";
import { resolveTemplateStyle } from "~/remotion/templates/style";

import type { ArollKeep, ProjectConfig } from "~/domain/project-config";
import type { OutputTime } from "~/domain/time";
import type { TranscriptWord } from "~/domain/transcript";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type {
  ArollSection,
  BrollClipProp,
  CaptionGroupProp,
  CaptionWordProp,
  ListicleOverlayProp,
  ProjectProps,
  SfxClipProp,
  ShakeClipProp,
  TextOverlayProp,
  ZoomProp,
} from "~/remotion/types";

export type BuildProjectPropsInput = {
  config: ProjectConfig;
  /** assetId → signed playback URL */
  mediaUrls: ReadonlyMap<string, string>;
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>;
  /** assetId → media duration (for timeline→output edit mapping). */
  assetDurationSec: ReadonlyMap<string, number>;
  /** assetId → natural size for b-roll contain-fit. */
  assetSize: ReadonlyMap<string, { width: number; height: number }>;
  /** assetId → media kind (image|video|audio). */
  assetKind: ReadonlyMap<string, "video" | "image" | "audio">;
  fps?: number;
};

function secToFrame(sec: number, fps: number): number {
  return Math.max(0, Math.round(sec * fps));
}

function buildSections(
  arolls: readonly ArollKeep[],
  mediaUrls: ReadonlyMap<string, string>,
  fps: number,
): ArollSection[] {
  return arolls.map((keep) => {
    const trimBefore = secToFrame(keep.start, fps);
    const trimAfter = secToFrame(keep.end, fps);
    const durationInFrames = Math.max(1, trimAfter - trimBefore);
    return {
      assetId: keep.assetId,
      src: mediaUrls.get(keep.assetId) ?? "",
      trimBefore,
      trimAfter,
      durationInFrames,
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
  const quotes = outputQuotes(config.edits, cells);
  const hiddenRanges = hiddenCaptionRanges(config.edits, cells);
  const words = projectOutputWords(config.arolls, transcriptsByAssetId);

  type StyledWord = CaptionWordProp & {
    styleKey: string;
    segmentKey: string;
    captionsAtATime: number;
    style: CaptionGroupStyle;
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
    styledWords.push({
      text: word.text,
      startFrame,
      endFrame,
      ...(word.emphasized ? { emphasized: true } : {}),
      styleKey: quote ? `quote:${quote.id}` : "default",
      segmentKey: String(segment),
      captionsAtATime: style.captionsAtATime,
      style,
    });
  }

  const styleByKey = new Map<string, CaptionGroupStyle>();
  for (const word of styledWords) {
    styleByKey.set(word.styleKey, word.style);
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
      return {
        words: displayWords,
        startFrame: displayWords[0]!.startFrame,
        endFrame: displayWords[displayWords.length - 1]!.endFrame,
        captionsAtATime: style.captionsAtATime,
        style,
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
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): TextOverlayProp[] {
  const out: TextOverlayProp[] = [];
  for (const e of edits) {
    if (e.kind !== "vfx" || e.type !== "text") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      text: e.text,
      style: e.style,
    });
  }
  return out;
}

function buildListicleOverlays(
  config: ProjectConfig,
  cells: ReturnType<typeof buildArollLayout>,
  fps: number,
): ListicleOverlayProp[] {
  const templateId = isListicleTemplateId(config.listicleStyle.templateId)
    ? config.listicleStyle.templateId
    : DEFAULT_LISTICLE_TEMPLATE_ID;
  const styles = resolveListicleTextStyles(
    templateId,
    config.listicleStyle.overrides,
  );
  const out: ListicleOverlayProp[] = [];

  for (const e of config.edits) {
    if (e.kind !== "vfx" || e.type !== "listicle") continue;
    const range = timelineRangeToOutput(cells, e);
    if (!range) continue;

    const startFrame = secToFrame(range.start, fps);
    const endFrame = Math.max(startFrame + 1, secToFrame(range.end, fps));
    let middleFrame: number | null = null;
    if (e.middle != null) {
      const span = Math.max(0.001, e.end - e.start);
      const t = Math.min(1, Math.max(0, (e.middle - e.start) / span));
      const middleSec = range.start + t * (range.end - range.start);
      middleFrame = Math.min(
        endFrame,
        Math.max(startFrame, secToFrame(middleSec, fps)),
      );
    }

    out.push({
      id: e.id,
      startFrame,
      middleFrame,
      endFrame,
      indicatorText: e.indicatorText,
      valueText: e.valueText,
      indicatorStyle: styles.indicator,
      valueStyle: styles.value,
      stacked: styles.stacked,
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

function buildSfx(
  edits: ProjectConfig["edits"],
  cells: ReturnType<typeof buildArollLayout>,
  mediaUrls: ReadonlyMap<string, string>,
  assetKind: ReadonlyMap<string, "video" | "image" | "audio">,
  fps: number,
): SfxClipProp[] {
  const out: SfxClipProp[] = [];
  for (const e of edits) {
    if (e.kind !== "sfx") continue;
    const src = mediaUrls.get(e.assetId);
    if (!src) continue;
    if (assetKind.get(e.assetId) !== "audio") continue;
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
      mediaOffsetSec: e.mediaOffsetSec,
      volume: e.volume,
    });
  }
  return out;
}

export function buildProjectProps(input: BuildProjectPropsInput): ProjectProps {
  const fps = input.fps ?? COMPOSITION_FPS ?? PROJECT_FPS;
  const sections = buildSections(
    input.config.arolls,
    input.mediaUrls,
    fps,
  ).filter((s) => s.src.length > 0);

  const layout = buildArollLayout(input.config.arolls, input.assetDurationSec);
  const durationSec = outputDurationFromArolls(input.config.arolls);
  const durationInFrames = Math.max(1, secToFrame(durationSec, fps));

  return {
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
    textOverlays: buildTextOverlays(input.config.edits, layout, fps),
    listicleOverlays: buildListicleOverlays(input.config, layout, fps),
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
      fps,
    ),
  };
}
