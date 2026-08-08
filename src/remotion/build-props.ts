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
  CAPTION_GROUP_GAP_SEC,
  CAPTION_LAST_WORD_PAD_SEC,
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/constants";
import { resolveCaptionStyle, transformCaptionText } from "~/remotion/captions/templates";
import type {
  ArollSection,
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

function stripPunctuation(text: string): string {
  return text.replace(/^[\s"'([{]+|[\s"'.,!?;:)\]}]+$/g, "");
}

function buildCaptionGroups(
  config: ProjectConfig,
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>,
  fps: number,
): CaptionGroupProp[] {
  const style = resolveCaptionStyle(
    config.captions.templateId,
    config.captions.overrides,
  );
  // Captions ride the compacted output clock (Remotion frames).
  const words = projectOutputWords(config.arolls, transcriptsByAssetId);
  const atATime = Math.max(1, style.captionsAtATime);

  const captionWords: CaptionWordProp[] = [];
  for (const word of words) {
    const text = stripPunctuation(
      transformCaptionText(word.text, style.textTransform),
    );
    if (!text) continue;
    const startFrame = secToFrame(word.start, fps);
    const endFrame = Math.max(startFrame + 3, secToFrame(word.end, fps));
    captionWords.push({
      text,
      startFrame,
      endFrame,
      emphasized: word.emphasized,
    });
  }

  const groups: CaptionGroupProp[] = [];
  for (let i = 0; i < captionWords.length; ) {
    const chunk = captionWords.slice(i, i + atATime);
    i += atATime;
    if (chunk.length === 0) continue;

    let endFrame = chunk[chunk.length - 1]!.endFrame;
    const next = captionWords[i];
    if (next) {
      const pad = Math.round(CAPTION_LAST_WORD_PAD_SEC * fps);
      const gap = Math.round(CAPTION_GROUP_GAP_SEC * fps);
      endFrame = Math.min(endFrame + pad, next.startFrame - gap);
      endFrame = Math.max(endFrame, chunk[chunk.length - 1]!.endFrame);
    } else {
      endFrame += Math.round(CAPTION_LAST_WORD_PAD_SEC * fps);
    }

    groups.push({
      words: chunk,
      startFrame: chunk[0]!.startFrame,
      endFrame: Math.max(chunk[0]!.startFrame + 1, endFrame),
      captionsAtATime: atATime,
    });
  }

  return groups;
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
  };
}
