import { produce } from "immer";

import { withBrollKenBurns } from "~/domain/broll";
import {
  clampTimelineRangeToMedia,
  withMediaOffset,
  withVolume,
} from "~/domain/media";
import {
  nextEditId,
  type BrollEdit,
  type Edit,
  type EditBase,
  type MediaRef,
  type ProjectConfig,
  type Transform,
} from "~/domain/project-config";
import { sfxSeed } from "~/domain/sfx";
import type { TimelineTime } from "~/domain/time";
import { withTransform } from "~/domain/transform";

const EPS = 0.001;
const MIN_RANGE_SEC = 0.05;
export const DEFAULT_ZOOM_SCALE = 1.1;

/** External facts needed at place/patch time (lives outside ProjectConfig). */
export type PlaceEditContext = {
  /** Source duration for an asset id; null/undefined = unconstrained (e.g. image). */
  srcDurationSec?: (assetId: string) => number | null | undefined;
};

/** Edit fields supplied at place-time (id + range filled by `placeEdit`). */
export type EditSeed = Edit extends infer E
  ? E extends Edit
    ? Omit<E, "id" | "start" | "end">
    : never
  : never;

/**
 * Partial body for an existing edit. Discriminant (`kind` / vfx `type`) is fixed;
 * use remove + place to change identity.
 * `kenBurns: null` clears optional Ken Burns on b-roll.
 */
export type EditPatch = Edit extends infer E
  ? E extends Edit
    ? Partial<Omit<E, "id" | "kind" | "type" | "kenBurns">> & {
        kenBurns?: number | null;
      }
    : never
  : never;

function hasTransform(edit: Edit): edit is Edit & Transform {
  return "offsetX" in edit && "offsetY" in edit && "rotation" in edit;
}

function hasMediaRef(
  edit: Edit,
): edit is Edit & MediaRef & { start: number; end: number } {
  return (
    "assetId" in edit && "mediaOffsetSec" in edit && "volume" in edit
  );
}

function clampRange(
  range: TimelineTime,
  timelineDuration: number,
): TimelineTime | null {
  let s = Math.max(0, Math.min(range.start, range.end));
  let e = Math.min(timelineDuration, Math.max(range.start, range.end));
  if (e - s < MIN_RANGE_SEC) return null;
  return { start: s, end: e };
}

export function removeEdit(config: ProjectConfig, id: number): ProjectConfig {
  return produce(config, (draft) => {
    draft.edits = draft.edits.filter((e) => e.id !== id);
  });
}

export function patchEditRange(
  config: ProjectConfig,
  id: number,
  range: TimelineTime,
  timelineDuration: number,
): ProjectConfig {
  const clamped = clampRange(range, timelineDuration);
  if (!clamped) return config;
  return produce(config, (draft) => {
    const edit = draft.edits.find((e) => e.id === id);
    if (!edit) return;
    edit.start = clamped.start;
    edit.end = clamped.end;
  });
}

function appendEdit(
  config: ProjectConfig,
  range: TimelineTime,
  timelineDuration: number,
  seed: EditSeed,
): { config: ProjectConfig; placed: Edit } | null {
  const clamped = clampRange(range, timelineDuration);
  if (!clamped) return null;
  const placed = {
    ...seed,
    id: nextEditId(config.edits),
    start: clamped.start,
    end: clamped.end,
  } as Edit;
  const next = produce(config, (draft) => {
    draft.edits.push(placed);
  });
  return { config: next, placed };
}

/**
 * Place-time side effects after a successful append (e.g. default b-roll entrance SFX).
 * Pure Model — no store/UI.
 */
export function applyPlaceSideEffects(
  config: ProjectConfig,
  placed: Edit,
  timelineDuration: number,
  ctx?: PlaceEditContext,
): ProjectConfig {
  if (placed.kind !== "broll") return config;
  const sfxAssetId = config.defaultBRollSfxAssetId;
  if (!sfxAssetId) return config;

  const sfxDur = ctx?.srcDurationSec?.(sfxAssetId) ?? null;
  let sfxRange: TimelineTime = { start: placed.start, end: placed.end };
  if (sfxDur != null) {
    sfxRange = clampTimelineRangeToMedia(
      { start: placed.start, end: placed.start + sfxDur },
      sfxDur,
    );
  }
  return (
    appendEdit(config, sfxRange, timelineDuration, sfxSeed(sfxAssetId))
      ?.config ?? config
  );
}

export function placeEdit(
  config: ProjectConfig,
  range: TimelineTime,
  timelineDuration: number,
  seed: EditSeed,
  ctx?: PlaceEditContext,
): ProjectConfig {
  const result = appendEdit(config, range, timelineDuration, seed);
  if (!result) return config;
  return applyPlaceSideEffects(
    result.config,
    result.placed,
    timelineDuration,
    ctx,
  );
}

/** Same asset lookup as place — kept as an alias for patch call sites. */
export type PatchEditContext = PlaceEditContext;

/** Unconstrained edit fields — facets own everything else. */
const PLAIN_PATCH_KEYS = [
  "start",
  "end",
  "assetId",
  "text",
  "style",
] as const;

function applyPlainPatch(edit: Edit, patch: EditPatch): Edit {
  const raw = patch as Record<string, unknown>;
  let next = edit;
  for (const key of PLAIN_PATCH_KEYS) {
    if (!(key in raw) || raw[key] === undefined) continue;
    if (next === edit) next = { ...edit };
    (next as Record<string, unknown>)[key] = raw[key];
  }
  return next;
}

function applyTransformPatch(edit: Edit, patch: EditPatch): Edit {
  const tPatch: Partial<Transform> = {};
  if ("scale" in patch && typeof patch.scale === "number") {
    tPatch.scale = patch.scale;
  }
  if ("offsetX" in patch && typeof patch.offsetX === "number") {
    tPatch.offsetX = patch.offsetX;
  }
  if ("offsetY" in patch && typeof patch.offsetY === "number") {
    tPatch.offsetY = patch.offsetY;
  }
  if ("rotation" in patch && typeof patch.rotation === "number") {
    tPatch.rotation = patch.rotation;
  }
  if (Object.keys(tPatch).length === 0) return edit;

  if (hasTransform(edit)) return withTransform(edit, tPatch);
  if (typeof tPatch.scale === "number") {
    return { ...edit, scale: tPatch.scale } as Edit;
  }
  return edit;
}

function applyMediaPatch(
  edit: Edit,
  patch: EditPatch,
  ctx?: PatchEditContext,
): Edit {
  if (!hasMediaRef(edit)) return edit;
  let next = edit;
  if ("volume" in patch && typeof patch.volume === "number") {
    next = withVolume(next, patch.volume);
  }
  if ("mediaOffsetSec" in patch && typeof patch.mediaOffsetSec === "number") {
    const src = ctx?.srcDurationSec?.(next.assetId) ?? null;
    next = withMediaOffset(next, patch.mediaOffsetSec, src);
  }
  return next;
}

function applyKenBurnsPatch(edit: Edit, patch: EditPatch): Edit {
  if (!("kenBurns" in patch) || edit.kind !== "broll") return edit;
  return withBrollKenBurns(edit, patch.kenBurns ?? null);
}

export function patchEdit(
  config: ProjectConfig,
  id: number,
  patch: EditPatch,
  ctx?: PatchEditContext,
): ProjectConfig {
  return produce(config, (draft) => {
    const idx = draft.edits.findIndex((e) => e.id === id);
    if (idx < 0) return;
    let next = draft.edits[idx]!;
    next = applyPlainPatch(next, patch);
    next = applyTransformPatch(next, patch);
    next = applyMediaPatch(next, patch, ctx);
    next = applyKenBurnsPatch(next, patch);
    draft.edits[idx] = next;
  });
}

export function editsOverlappingRange(
  edits: readonly Edit[],
  range: TimelineTime,
): Edit[] {
  return edits.filter(
    (e) => e.start < range.end - EPS && e.end > range.start + EPS,
  );
}

export function findEditById(
  edits: readonly Edit[],
  id: number,
): Edit | undefined {
  return edits.find((e) => e.id === id);
}

export function asEditBase(edit: Edit): EditBase {
  return { id: edit.id, start: edit.start, end: edit.end };
}
