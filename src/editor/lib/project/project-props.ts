import { maskEntry, maskProp } from "~/domain/asset/mask";
import { PROJECT_FPS } from "~/domain/project/project-config";
import { buildProjectProps, type PropsAsset } from "~/remotion/helpers/build-props";

import type { ProjectConfig } from "~/domain/project/project-config";
import type { TranscriptWord } from "~/domain/transcript/transcript";
import type { EditorAsset } from "~/editor/store";
import type { ProjectProps } from "~/remotion/helpers/types";

function transcriptMap(
  transcriptsByAssetId: Record<string, TranscriptWord[]>,
): Map<string, TranscriptWord[]> {
  return new Map(Object.entries(transcriptsByAssetId));
}

function propsAssetsFromEditor(assets: EditorAsset[]): Map<string, PropsAsset> {
  const map = new Map<string, PropsAsset>();
  for (const asset of assets) {
    map.set(asset.id, {
      src: asset.playbackUrl,
      kind: asset.kind,
      durationSec: asset.durationSec,
      width: asset.width,
      height: asset.height,
      lufs: asset.lufs,
      truePeakDb: asset.truePeakDb,
      ...maskProp(
        asset.mask
          ? maskEntry(asset.mask.type, asset.mask.playbackUrl)
          : undefined,
      ),
    });
  }
  return map;
}

export function projectPropsFromAssets(input: {
  config: ProjectConfig;
  title?: string | null;
  assets: EditorAsset[];
  transcriptsByAssetId: Record<string, TranscriptWord[]>;
  fps?: number;
}): ProjectProps {
  return buildProjectProps({
    config: input.config,
    title: input.title ?? undefined,
    transcriptsByAssetId: transcriptMap(input.transcriptsByAssetId),
    assets: propsAssetsFromEditor(input.assets),
    fps: input.fps ?? PROJECT_FPS,
  });
}
