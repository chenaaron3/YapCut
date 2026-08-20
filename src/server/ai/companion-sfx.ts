import {
  attachCompanionSfxToEdits,
  resolveCompanionSfxPool,
} from "~/domain/audio/companion-sfx";
import {
  defaultCompanionSfxMap,
  type CompanionSfxMap,
} from "~/domain/audio/companion-sfx-map";
import { isTextBaseEdit, nextEditId } from "~/domain/project/project-config";
import { COMPANION_SFX_VOLUME, pickSfxAssetId, sfxSeed } from "~/domain/edit/sfx";
import { editMiddleSec } from "~/domain/edit/vfx";
import { overlayStackedForEdit } from "~/remotion/templates/overlay";
import { loadGlobalSfxAssets } from "~/server/ai/global-sfx";

import type { CompanionSfxAsset } from "~/domain/audio/companion-sfx";
import type { Edit, SfxEdit } from "~/domain/project/project-config";

type DurationSecFor = (assetId: string) => number | null;

/** Sibling tick/pop at overlay `middle` from the overlayMiddle cue. */
function generateOverlayMiddleSfxEdits(
  edits: readonly Edit[],
  map: CompanionSfxMap,
  assets: readonly CompanionSfxAsset[],
  durationSecFor: DurationSecFor,
): SfxEdit[] {
  const pool = resolveCompanionSfxPool(map.overlayMiddle, assets);
  if (pool.length === 0) return [];

  let nextId = nextEditId(edits);
  const out: SfxEdit[] = [];

  for (const edit of edits) {
    if (!isTextBaseEdit(edit)) continue;
    const middle = editMiddleSec(edit, overlayStackedForEdit(edit));
    if (middle == null) continue;
    const assetId = pickSfxAssetId(pool, `middle-${edit.id}`);
    if (!assetId) continue;
    const dur = durationSecFor(assetId) ?? 0.35;
    out.push({
      id: nextId,
      ...sfxSeed(assetId, COMPANION_SFX_VOLUME),
      start: middle,
      end: middle + Math.max(0.05, dur),
    });
    nextId += 1;
  }

  return out;
}

/**
 * Create-time companionSfx on visuals, then overlay-middle sibling pops.
 * No LLM. Emphasis-word pings live in `emphasis-sfx`.
 */
export async function generateCompanionSfxEdits(options: {
  edits: readonly Edit[];
  companionSfx?: CompanionSfxMap;
  skipIds?: ReadonlySet<number>;
}): Promise<Edit[]> {
  const map = options.companionSfx ?? defaultCompanionSfxMap();
  const skipIds = options.skipIds ?? new Set<number>();
  const { assets: sfxAssets, durationByAssetId } = await loadGlobalSfxAssets();
  const durationSecFor = (assetId: string) =>
    durationByAssetId.get(assetId) ?? null;

  let edits = attachCompanionSfxToEdits(
    options.edits,
    map,
    sfxAssets,
    skipIds,
  );
  const attached = edits.filter((e) => e.companionSfx && !skipIds.has(e.id));
  console.log(`[ai-assist] companionSfx attached=${attached.length}`);

  const middlePops = generateOverlayMiddleSfxEdits(
    edits,
    map,
    sfxAssets,
    durationSecFor,
  );
  edits = [...edits, ...middlePops];
  console.log(`[ai-assist] overlayMiddleSfx=${middlePops.length}`);

  return edits;
}
