import { produce } from "immer";

import { buildArollLayout, durationMapFromArolls } from "~/domain/aroll/arolls";
import { SFX_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import { withBrollKenBurns } from "~/domain/edit/broll";
import { withCompanionSfx } from "~/domain/audio/companion-sfx";
import {
  clampTimelineRangeToMedia,
  isDurationLimitedMedia,
  withMediaOffset,
  withVolume,
} from "~/domain/media/media";
import { nextEditId } from "~/domain/project/project-config";
import { quoteRangeConflicts } from "~/domain/vfx/quote";
import { isShakeEdit, withShakeIntensity } from "~/domain/vfx/shake";
import { withTransform } from "~/domain/edit/transform";
import {
  isTransitionEdit,
  materializeTransition,
  transitionStitchConflicts,
} from "~/domain/edit/transition";
import { withPlacedZoomEase } from "~/domain/edit/zoom";

import type { ArollLayoutCell } from "~/domain/aroll/arolls";
import type { CompanionSfxAsset } from "~/domain/audio/companion-sfx";
import type {
  Edit,
  EditBase,
  MediaRef,
  ProjectConfig,
  Transform,
} from "~/domain/project/project-config";
import type { TimelineTime } from "~/domain/media/time";

export { DEFAULT_ZOOM_SCALE } from "~/domain/edit/zoom";

const EPS = 0.001;
const MIN_RANGE_SEC = 0.05;

function layoutForConfig(
  config: ProjectConfig,
  ctx?: PlaceEditContext,
): ArollLayoutCell[] {
  return buildArollLayout(
    config.arolls,
    durationMapFromArolls(config.arolls, ctx?.srcDurationSec),
  );
}

/** External facts needed at place/patch time (lives outside ProjectConfig). */
export type PlaceEditContext = {
  /** Source duration for an asset id; null/undefined = unconstrained (e.g. image). */
  srcDurationSec?: (assetId: string) => number | null | undefined;
  /** Global/project SFX library for create-time companion pick. */
  sfxAssets?: readonly CompanionSfxAsset[];
};

/** Edit fields supplied at place-time (id + range filled by `placeEdit`). Kind-specific body comes from the caller (e.g. `transitionSeedFromWord`, `listicleSeedFromWords`). */
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
    ? Partial<Omit<E, "id" | "kind" | "type" | "kenBurns" | "companionSfx" | "behindPerson">> & {
        kenBurns?: number | null;
        /** `null` clears a nested companion. */
        companionSfx?: MediaRef | null;
        /** `false` clears (omit = in front). */
        behindPerson?: boolean;
      }
    : never
  : never;

function hasTransform(edit: Edit): edit is Edit & Transform {
  return "offsetX" in edit && "offsetY" in edit && "rotation" in edit;
}

function hasMediaRef(
  edit: Edit,
): edit is Edit & MediaRef & { start: number; end: number } {
  return "assetId" in edit && "mediaOffsetSec" in edit && "volume" in edit;
}

function clampRange(
  range: TimelineTime,
  timelineDuration: number,
): TimelineTime | null {
  const s = Math.max(0, Math.min(range.start, range.end));
  const e = Math.min(timelineDuration, Math.max(range.start, range.end));
  if (e - s < MIN_RANGE_SEC) return null;
  return { start: s, end: e };
}

export function removeEdit(config: ProjectConfig, id: number): ProjectConfig {
  return produce(config, (draft) => {
    draft.edits = draft.edits.filter((e) => e.id !== id);
  });
}

export type RangeEdge = "start" | "end";

function srcDurationOf(edit: Edit, ctx?: PatchEditContext): number | null {
  if (!hasMediaRef(edit)) return null;
  return ctx?.srcDurationSec?.(edit.assetId) ?? null;
}

function isDurationLimitedEdit(
  edit: Edit,
  srcDurationSec: number | null,
): edit is Edit & MediaRef & { start: number; end: number } {
  return (
    hasMediaRef(edit) &&
    isDurationLimitedMedia({
      mediaOffsetSec: edit.mediaOffsetSec,
      srcDurationSec,
    })
  );
}

/**
 * Propose a new range from dragging one edge.
 * Duration-limited media: start = move (preserve duration); end = resize.
 * Otherwise both edges resize with a fixed opposite edge.
 */
export function rangeFromEdgeDrag(
  existing: { start: number; end: number },
  edge: RangeEdge,
  value: number,
  opts?: { mediaOffsetSec?: number; srcDurationSec?: number | null },
): TimelineTime {
  if (edge === "start") {
    const durationLimited =
      opts?.mediaOffsetSec != null &&
      isDurationLimitedMedia({
        mediaOffsetSec: opts.mediaOffsetSec,
        srcDurationSec: opts.srcDurationSec,
      });
    if (durationLimited) {
      const dur = existing.end - existing.start;
      const start = Math.max(0, value);
      return { start, end: start + dur };
    }
    const start = Math.min(Math.max(0, value), existing.end - MIN_RANGE_SEC);
    return { start, end: existing.end };
  }
  const end = Math.max(value, existing.start + MIN_RANGE_SEC);
  return { start: existing.start, end };
}

/** End-edge / absolute resize: keep media-backed edits within source media. */
function clampMediaEditRange(
  existing: Edit,
  range: TimelineTime,
  ctx?: PatchEditContext,
): TimelineTime {
  if (!hasMediaRef(existing)) return range;
  const src = srcDurationOf(existing, ctx);
  return clampTimelineRangeToMedia(range, src, existing.mediaOffsetSec);
}

/** Keep duration; slide into [0, timelineDuration]. */
function fitMoveInTimeline(
  range: TimelineTime,
  timelineDuration: number,
): TimelineTime | null {
  const dur = range.end - range.start;
  if (dur < MIN_RANGE_SEC) return null;
  let start = Math.max(0, range.start);
  let end = start + dur;
  if (end > timelineDuration) {
    end = timelineDuration;
    start = end - dur;
  }
  if (start < 0 || end - start < MIN_RANGE_SEC) return null;
  return { start, end };
}

function applyEditRange(
  config: ProjectConfig,
  existing: Edit,
  range: TimelineTime,
): ProjectConfig {
  if (
    Math.abs(range.start - existing.start) < EPS &&
    Math.abs(range.end - existing.end) < EPS
  ) {
    return config;
  }
  if (
    existing.kind === "vfx" &&
    existing.type === "quote" &&
    quoteRangeConflicts(config.edits, range, existing.id)
  ) {
    return config;
  }
  return produce(config, (draft) => {
    const edit = draft.edits.find((e) => e.id === existing.id);
    if (!edit) return;
    edit.start = range.start;
    edit.end = range.end;
  });
}

/** Drag one edge — move vs trim policy lives in `rangeFromEdgeDrag`. */
export function patchEditRange(
  config: ProjectConfig,
  id: number,
  edge: RangeEdge,
  value: number,
  timelineDuration: number,
  ctx?: PatchEditContext,
): ProjectConfig {
  const existing = config.edits.find((e) => e.id === id);
  if (!existing) return config;

  const src = srcDurationOf(existing, ctx);
  const proposed = rangeFromEdgeDrag(existing, edge, value, {
    mediaOffsetSec: hasMediaRef(existing) ? existing.mediaOffsetSec : undefined,
    srcDurationSec: src,
  });

  let clamped: TimelineTime | null;
  if (edge === "start" && isDurationLimitedEdit(existing, src)) {
    clamped = fitMoveInTimeline(
      clampTimelineRangeToMedia(proposed, src, existing.mediaOffsetSec),
      timelineDuration,
    );
  } else {
    clamped = clampRange(proposed, timelineDuration);
    if (!clamped) return config;
    clamped = clampMediaEditRange(existing, clamped, ctx);
  }

  if (!clamped || clamped.end - clamped.start < MIN_RANGE_SEC) return config;
  return applyEditRange(config, existing, clamped);
}

export type PlaceEditFailure =
  | "invalid-range"
  | "quote-overlap"
  | "transition-conflict";

export type PlaceEditResult =
  | { ok: true; config: ProjectConfig; placed: Edit }
  | { ok: false; reason: PlaceEditFailure };

function appendEdit(
  config: ProjectConfig,
  range: TimelineTime,
  timelineDuration: number,
  seed: EditSeed,
  ctx?: PlaceEditContext,
): PlaceEditResult {
  const clamped = clampRange(range, timelineDuration);
  if (!clamped) return { ok: false, reason: "invalid-range" };
  if (
    seed.kind === "vfx" &&
    seed.type === "quote" &&
    quoteRangeConflicts(config.edits, clamped)
  ) {
    return { ok: false, reason: "quote-overlap" };
  }
  if (
    seed.kind === "transition" &&
    transitionStitchConflicts(
      config.edits,
      seed.stitch,
      seed.durationSec,
      layoutForConfig(config, ctx),
    )
  ) {
    return { ok: false, reason: "transition-conflict" };
  }
  const placed = withCompanionSfx(
    withPlacedZoomEase({
      ...seed,
      id: nextEditId(config.edits),
      start: clamped.start,
      end: clamped.end,
    } as Edit),
    config.companionSfx,
    ctx?.sfxAssets ?? [],
  );
  const next = produce(config, (draft) => {
    draft.edits.push(placed);
  });
  return { ok: true, config: next, placed };
}

export function placeEdit(
  config: ProjectConfig,
  range: TimelineTime,
  timelineDuration: number,
  seed: EditSeed,
  ctx?: PlaceEditContext,
): PlaceEditResult {
  return appendEdit(config, range, timelineDuration, seed, ctx);
}

/** Same asset lookup as place — kept as an alias for patch call sites. */
export type PatchEditContext = PlaceEditContext;

/** Unconstrained edit fields — facets own everything else. */
const PLAIN_PATCH_KEYS = [
  "start",
  "end",
  "middle",
  "assetId",
  "heading",
  "subheading",
  "hideCaptions",
  "style",
  "ease",
  "emphasisStyle",
  "templateId",
  "durationSec",
  "plan",
  "catalogId",
  "source",
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
  if (!hasTransform(edit)) return edit;
  return withTransform(edit, tPatch);
}

function applyMediaPatch(
  edit: Edit,
  patch: EditPatch,
  ctx?: PatchEditContext,
): Edit {
  if (!hasMediaRef(edit)) return edit;
  let next = edit;
  if ("volume" in patch && typeof patch.volume === "number") {
    next = withVolume(
      next,
      patch.volume,
      next.kind === "sfx" ? SFX_VOLUME_DEFAULT : undefined,
    );
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

function applyShakeIntensityPatch(edit: Edit, patch: EditPatch): Edit {
  if (!("intensity" in patch) || typeof patch.intensity !== "number") {
    return edit;
  }
  if (!isShakeEdit(edit)) return edit;
  return withShakeIntensity(edit, patch.intensity);
}

function applyCompanionSfxPatch(edit: Edit, patch: EditPatch): Edit {
  if (!("companionSfx" in patch)) return edit;
  if (patch.companionSfx == null) {
    if (!edit.companionSfx) return edit;
    const { companionSfx: _removed, ...rest } = edit;
    return rest as Edit;
  }
  return { ...edit, companionSfx: patch.companionSfx };
}

/** `true` = behind the person; omit / false = in front. */
function applyBehindPersonPatch(edit: Edit, patch: EditPatch): Edit {
  if (!("behindPerson" in patch)) return edit;
  if (patch.behindPerson === true) {
    if ("behindPerson" in edit && edit.behindPerson === true) return edit;
    return { ...edit, behindPerson: true } as Edit;
  }
  if (!("behindPerson" in edit)) return edit;
  const { behindPerson: _removed, ...rest } = edit;
  return rest as Edit;
}

/** Recompute derived `{start,end}` from stitch + duration. */
function applyTransitionPatch(
  edit: Edit,
  config: ProjectConfig,
  ctx?: PatchEditContext,
): Edit {
  if (!isTransitionEdit(edit)) return edit;
  return materializeTransition(edit, layoutForConfig(config, ctx)) ?? edit;
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
    next = applyShakeIntensityPatch(next, patch);
    next = applyCompanionSfxPatch(next, patch);
    next = applyBehindPersonPatch(next, patch);
    next = applyTransitionPatch(next, config, ctx);
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

/** Edits AI re-run keeps (b-roll). Other kinds are replaced. */
export function editsForAiAssist(edits: readonly Edit[]): Edit[] {
  return edits.filter((e) => e.kind === "broll");
}

export function asEditBase(edit: Edit): EditBase {
  return { id: edit.id, start: edit.start, end: edit.end };
}
