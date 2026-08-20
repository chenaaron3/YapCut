import { assetRunForAssetId } from "~/domain/aroll/arolls";

import type { ArollAssetRun } from "~/domain/aroll/arolls";
import type { ProjectConfig } from "~/domain/project/project-config";
import type { Selection } from "~/editor/lib/selection/selection";

export function selectedArollAssetId(
  selection: Selection | null | undefined,
): string | null {
  if (selection?.kind !== "arollAsset" || selection.ids.length === 0) {
    return null;
  }
  const id = selection.ids[selection.ids.length - 1]!;
  return typeof id === "string" ? id : null;
}

export function selectedArollAssetRun(
  selection: Selection | null | undefined,
  config: ProjectConfig | null | undefined,
  assetDurationSec: ReadonlyMap<string, number>,
): ArollAssetRun | null {
  const assetId = selectedArollAssetId(selection);
  if (!assetId || !config) return null;
  return assetRunForAssetId(config.arolls, assetDurationSec, assetId);
}
