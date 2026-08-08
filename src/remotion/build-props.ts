import {
  buildArollLayout,
  timelineRangeToOutput,
} from "~/domain/arolls";
import {
  outputDurationFromArolls,
  PROJECT_FPS,
  type ArollKeep,
  type ProjectConfig,
} from "~/domain/project-config";
import { projectOutputWords } from "~/domain/projection";
import type { TranscriptWord } from "~/domain/transcript";
import { DEFAULT_ZOOM_SCALE } from "~/domain/edits";
import {
  applyCaptionOverrides,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
} from "~/remotion/templates/caption";
import {
  groupCaptionWords,
  isFiller,
  padLastWordInGroups,
  stripPunctuationForDisplay,
} from "~/remotion/captions/words";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/constants";
import type {
  ArollSection,
  BrollClipProp,
  CaptionGroupProp,
  CaptionWordProp,
  ProjectProps,
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

function buildCaptionGroups(
  config: ProjectConfig,
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>,
  fps: number,
): CaptionGroupProp[] {
  const style = resolveProjectCaptionStyle(config.captions);
  const words = projectOutputWords(config.arolls, transcriptsByAssetId);

  // Keep source punctuation through grouping so sentence boundaries work;
  // strip for on-screen display after groups are formed.
  const captionWords: CaptionWordProp[] = [];
  for (const word of words) {
    if (isFiller(word.text) || !word.text.trim()) continue;
    const startFrame = secToFrame(word.start, fps);
    const endFrame = Math.max(startFrame + 3, secToFrame(word.end, fps));
    captionWords.push({
      text: word.text,
      startFrame,
      endFrame,
      ...(word.emphasized ? { emphasized: true } : {}),
    });
  }

  const rawGroups = groupCaptionWords(captionWords, style.captionsAtATime);
  const displayGroups = rawGroups
    .map((group) => {
      const displayWords = group.words
        .map((w) => ({
          ...w,
          text: stripPunctuationForDisplay(w.text),
        }))
        .filter((w) => w.text.length > 0);
      if (displayWords.length === 0) return null;
      return {
        words: displayWords,
        startFrame: displayWords[0]!.startFrame,
        endFrame: displayWords[displayWords.length - 1]!.endFrame,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g != null);

  const padded = padLastWordInGroups(displayGroups, fps);

  return padded.map((group) => ({
    ...group,
    captionsAtATime: style.captionsAtATime,
    style,
  }));
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
    out.push({
      id: e.id,
      startFrame: secToFrame(range.start, fps),
      endFrame: Math.max(
        secToFrame(range.start, fps) + 1,
        secToFrame(range.end, fps),
      ),
      scale: e.scale ?? DEFAULT_ZOOM_SCALE,
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

export function buildProjectProps(input: BuildProjectPropsInput): ProjectProps {
  const fps = input.fps ?? COMPOSITION_FPS ?? PROJECT_FPS;
  const sections = buildSections(
    input.config.arolls,
    input.mediaUrls,
    fps,
  ).filter((s) => s.src.length > 0);

  const layout = buildArollLayout(
    input.config.arolls,
    input.assetDurationSec,
  );
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
      fps,
    ),
    zooms: buildZooms(input.config.edits, layout, fps),
    textOverlays: buildTextOverlays(input.config.edits, layout, fps),
    brolls: buildBrolls(
      input.config.edits,
      layout,
      input.mediaUrls,
      input.assetSize,
      input.assetKind,
      fps,
    ),
  };
}
