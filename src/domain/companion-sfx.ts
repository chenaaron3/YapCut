import { companionSfxRef, pickSfxAssetId, sfxFolderOf } from "~/domain/sfx";
import { resolveZoomEase } from "~/domain/zoom";

import type {
  CompanionSfxCueId,
  CompanionSfxMap,
  CompanionSfxSource,
} from "~/domain/companion-sfx-map";
import type { Edit, MediaRef } from "~/domain/project-config";

export type CompanionSfxAsset = {
  id: string;
  originalFilename?: string | null;
};

const ONSET_EPS = 0.001;

function normalizeSfxPath(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\\/g, "/");
}

/** Cue for a visual edit, or null when the factory should stay silent. */
export function cueForEdit(edit: Edit): CompanionSfxCueId | null {
  if (edit.kind === "sfx") return null;
  if (edit.kind === "broll") return "broll";
  if (edit.kind === "zoom") {
    return resolveZoomEase(edit.ease) ? null : "zoom";
  }
  if (edit.kind === "vfx") {
    if (edit.type === "text") return "text";
    if (edit.type === "quote") return "quote";
    if (edit.type === "listicle") return "listicle";
    return null;
  }
  if (edit.kind === "transition") {
    if (edit.templateId === "flash" || edit.templateId === "flashZoom") {
      return "flash";
    }
    if (edit.templateId === "slide") return "slide";
  }
  if (edit.kind === "sticker") return null;
  return null;
}

export function resolveCompanionSfxPool(
  source: CompanionSfxSource,
  assets: readonly CompanionSfxAsset[],
): string[] {
  if (source.type === "none") return [];
  if (source.type === "paths") {
    const want = new Set(
      source.paths.map(normalizeSfxPath).filter((p): p is string => p != null),
    );
    return assets
      .filter((a) => {
        const path = normalizeSfxPath(a.originalFilename);
        return path != null && want.has(path);
      })
      .map((a) => a.id);
  }
  return assets
    .filter((a) => sfxFolderOf(a.originalFilename) === source.folder)
    .map((a) => a.id);
}

/** Hash-pick a companion ref from the matching cue, or null. */
export function companionSfxForEdit(
  edit: Edit,
  map: CompanionSfxMap,
  assets: readonly CompanionSfxAsset[],
): MediaRef | null {
  const cue = cueForEdit(edit);
  if (!cue) return null;
  const pool = resolveCompanionSfxPool(map[cue], assets);
  const assetId = pickSfxAssetId(pool, String(edit.id));
  if (!assetId) return null;
  return companionSfxRef(assetId);
}

/** Create-time attach. Leaves an existing `companionSfx` untouched. */
export function withCompanionSfx<T extends Edit>(
  edit: T,
  map: CompanionSfxMap,
  assets: readonly CompanionSfxAsset[],
): T {
  if (edit.companionSfx) return edit;
  const ref = companionSfxForEdit(edit, map, assets);
  if (!ref) return edit;
  return { ...edit, companionSfx: ref };
}

export function attachCompanionSfxToEdits(
  edits: readonly Edit[],
  map: CompanionSfxMap,
  assets: readonly CompanionSfxAsset[],
  skipIds?: ReadonlySet<number>,
): Edit[] {
  return edits.map((edit) => {
    if (skipIds?.has(edit.id)) return edit;
    return withCompanionSfx(edit, map, assets);
  });
}

/** True when a companion or sibling SFX starts at this instant. */
export function hasSfxOnsetAt(
  edits: readonly Edit[],
  timeSec: number,
): boolean {
  for (const edit of edits) {
    if (edit.kind === "sfx" && Math.abs(edit.start - timeSec) < ONSET_EPS) {
      return true;
    }
    if (edit.companionSfx && Math.abs(edit.start - timeSec) < ONSET_EPS) {
      return true;
    }
  }
  return false;
}
