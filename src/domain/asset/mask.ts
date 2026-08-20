import { buildArollLayout } from "~/domain/aroll/arolls";

import type { ArollKeep, Edit } from "~/domain/project/project-config";
import type { TimelineTime } from "~/domain/media/time";

const EPS = 0.001;

/** Mask.type: A-roll Separate background (occlude) or B-roll Remove background (cutout). */
export type MaskType = "cutout" | "occlude";

export type MaskRole = "aroll" | "broll";

export function isMaskType(value: unknown): value is MaskType {
  return value === "cutout" || value === "occlude";
}

export function parseMaskType(value: unknown): MaskType | null {
  return isMaskType(value) ? value : null;
}

/** Paint-time mask: type + hard-mask src. Omit / undefined = Off. */
export type MaskEntry = {
  type: MaskType;
  src: string;
};

export function maskEntry(
  type: MaskType,
  src: string | null | undefined,
): MaskEntry | undefined {
  if (!src) return undefined;
  return { type, src };
}

export function maskProp(
  mask: MaskEntry | null | undefined,
): { mask: MaskEntry } | Record<string, never> {
  return mask ? { mask } : {};
}

/** A-roll: Separate background (Occlude). B-roll: Remove background (Cutout). */
export function maskTypesForRole(role: MaskRole): readonly MaskType[] {
  return role === "aroll" ? ["occlude"] : ["cutout"];
}

/**
 * A-roll Separate background. Stored Cutout (removed from the inspector) plays as Occlude.
 */
export function arollPlaybackMask(
  mask: MaskEntry | null | undefined,
): MaskEntry | undefined {
  if (!mask) return undefined;
  return { type: "occlude", src: mask.src };
}

export function maskTypeByAssetId(
  assets: readonly {
    id: string;
    mask?: { type: MaskType } | null;
  }[],
): Map<string, MaskType> {
  const map = new Map<string, MaskType>();
  for (const asset of assets) {
    if (asset.mask) map.set(asset.id, asset.mask.type);
  }
  return map;
}

/** Top-level library visuals (masks are nested on the parent, not listed). */
export function isLibraryVisualAsset(asset: { kind: string }): boolean {
  return asset.kind === "image" || asset.kind === "video";
}

/**
 * Title, quote, listicle, motion, sticker, b-roll can sit behind the person.
 * Captions / zoom / shake / transition / SFX cannot.
 */
export function editCanSitBehindPerson(edit: Edit): boolean {
  if (edit.kind === "broll" || edit.kind === "sticker") return true;
  if (edit.kind !== "vfx") return false;
  return (
    edit.type === "text" ||
    edit.type === "quote" ||
    edit.type === "listicle" ||
    edit.type === "motion"
  );
}

export function editSitsBehindPerson(edit: Edit): boolean {
  return (
    editCanSitBehindPerson(edit) &&
    "behindPerson" in edit &&
    edit.behindPerson === true
  );
}

export function behindPersonProp(
  edit: Edit,
): { behindPerson: true } | Record<string, never> {
  return editSitsBehindPerson(edit) ? { behindPerson: true } : {};
}

export function partitionBehindPerson<T extends { behindPerson?: boolean }>(
  items: readonly T[],
): { behind: T[]; front: T[] } {
  const behind: T[] = [];
  const front: T[] = [];
  for (const item of items) {
    if (item.behindPerson) behind.push(item);
    else front.push(item);
  }
  return { behind, front };
}

/** True when any keep overlapping `range` has Separate background (Occlude, or leftover Cutout). */
export function timelineRangeOverlapsMask(
  arolls: readonly ArollKeep[],
  durations: ReadonlyMap<string, number>,
  maskTypeByAssetId: ReadonlyMap<string, MaskType>,
  range: TimelineTime,
): boolean {
  const layout = buildArollLayout(arolls, durations);
  for (const cell of layout) {
    if (cell.kind !== "keep") continue;
    if (
      cell.timeline.end <= range.start + EPS ||
      cell.timeline.start >= range.end - EPS
    ) {
      continue;
    }
    if (maskTypeByAssetId.has(cell.local.assetId)) return true;
  }
  return false;
}
