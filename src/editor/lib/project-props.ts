import { durationMapFromAssets } from "~/domain/arolls";
import { PROJECT_FPS } from "~/domain/project-config";
import { buildProjectProps } from "~/remotion/helpers/build-props";

import type { ProjectConfig } from "~/domain/project-config";
import type { TranscriptWord } from "~/domain/transcript";
import type { EditorAsset } from "~/editor/store";
import type { ProjectProps } from "~/remotion/helpers/types";

function mediaUrlMap(assets: EditorAsset[]): Map<string, string> {
  return new Map(assets.map((a) => [a.id, a.playbackUrl]));
}

function transcriptMap(
  transcriptsByAssetId: Record<string, TranscriptWord[]>,
): Map<string, TranscriptWord[]> {
  return new Map(Object.entries(transcriptsByAssetId));
}

function sizeMap(
  assets: EditorAsset[],
): Map<string, { width: number; height: number }> {
  const map = new Map<string, { width: number; height: number }>();
  for (const a of assets) {
    if (a.width != null && a.height != null && a.width > 0 && a.height > 0) {
      map.set(a.id, { width: a.width, height: a.height });
    }
  }
  return map;
}

function kindMap(
  assets: EditorAsset[],
): Map<string, "video" | "image" | "audio"> {
  return new Map(assets.map((a) => [a.id, a.kind]));
}

function loudnessMap(
  assets: EditorAsset[],
): Map<string, { lufs: number | null; truePeakDb: number | null }> {
  return new Map(
    assets.map((a) => [a.id, { lufs: a.lufs, truePeakDb: a.truePeakDb }]),
  );
}

export function projectPropsFromAssets(input: {
  config: ProjectConfig;
  title?: string | null;
  assets: EditorAsset[];
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
}): ProjectProps {
  return buildProjectProps({
    config: input.config,
    title: input.title ?? undefined,
    mediaUrls: mediaUrlMap(input.assets),
    transcriptsByAssetId: transcriptMap(input.transcriptsByAssetId),
    assetDurationSec: durationMapFromAssets(input.assets),
    assetSize: sizeMap(input.assets),
    assetKind: kindMap(input.assets),
    assetLoudness: loudnessMap(input.assets),
    fps: PROJECT_FPS,
  });
}
