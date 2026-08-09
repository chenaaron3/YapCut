import { z } from 'zod';

import type { LocalTime, TimelineTime } from "~/domain/time";

/** Catalog base + sparse user overrides. */
export type TemplateStyle = {
  templateId: string;
  overrides?: Record<string, unknown>;
};

/** One keep segment on an A-roll asset (local seconds). */
export type ArollKeep = LocalTime;

export type EditId = number;

/** Shared fields on every Edit (expanded timeline seconds — gaps count). */
export type EditBase = TimelineTime & {
  id: EditId;
};

/**
 * Mixin for edits that can suppress spoken captions under their timeline range.
 * Opt in per edit type (listicle today; others can intersect later).
 */
export type CanHideCaptions = {
  /** When true, hide spoken captions under [start, end]. */
  hideCaptions: boolean;
};

/** True when this edit opts into caption hiding and the flag is on. */
export function editHidesCaptions(
  edit: EditBase,
): edit is EditBase & CanHideCaptions {
  return (
    "hideCaptions" in edit &&
    (edit as CanHideCaptions).hideCaptions === true
  );
}

/**
 * Zoom = timeline range + end-keyframe transform.
 * Start is always identity; `ease` interpolates identity → end over the range
 * (omit/false = hard snap to end for the whole range).
 */
export type ZoomEdit = EditBase &
  Transform & {
    kind: "zoom";
    ease?: boolean;
  };

export type VfxTextEdit = EditBase & {
  kind: "vfx";
  type: "text";
  text: string;
  style?: TemplateStyle;
};

export type VfxQuoteEdit = EditBase & {
  kind: "vfx";
  type: "quote";
  style?: TemplateStyle;
};

/**
 * Indicator + value text VFX.
 * `middle` set → staggered reveal (value joins at middle).
 * `middle` null → simultaneous (stacked) or value-only (not stacked).
 */
export type VfxListicleEdit = EditBase &
  CanHideCaptions & {
    kind: "vfx";
    type: "listicle";
    /** Timeline sec where value appears; null = not staggered. */
    middle: number | null;
    indicatorText: string;
    valueText: string;
  };

/** Normalized transform applied at props / overlay time. */
export type Transform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

/**
 * Edit-side ref to a project/global Asset (src/size live on the Asset row).
 * Counterpart to prototype VisualAsset, without inlined media bytes.
 */
export type MediaRef = {
  assetId: string;
  /** Trim into source media (sec). */
  mediaOffsetSec: number;
  /** Linear gain 0–1. */
  volume: number;
};

/**
 * B-roll edit = timeline range + transform + media ref.
 * `kenBurns` present means enabled (end-scale multiplier on `scale`).
 */
export type BrollEdit = EditBase &
  Transform &
  MediaRef & {
    kind: "broll";
    kenBurns?: number;
  };

export type SfxEdit = EditBase &
  MediaRef & {
    kind: "sfx";
  };

export type VfxEdit = VfxTextEdit | VfxQuoteEdit | VfxListicleEdit;

export type Edit = BrollEdit | SfxEdit | ZoomEdit | VfxEdit;

export type ProjectConfig = {
  arolls: ArollKeep[];
  edits: Edit[];
  captions: TemplateStyle;
  /**
   * Shared listicle look (all listicle edits use this).
   * Preset id only — no per-edit overrides.
   */
  listicleStyle: TemplateStyle;
  /**
   * Global audio Asset id placed as a sibling `sfx` edit when dropping b-roll.
   * `null` = no entrance SFX on place.
   */
  defaultBRollSfxAssetId: string | null;
};

export const DEFAULT_CAPTION_TEMPLATE_ID = "ugc";
export const DEFAULT_TEXT_VFX_DURATION_SEC = 5;
/** Output fps used for min-keep filtering (matches Remotion composition). */
export const PROJECT_FPS = 30;

/** Default listicle preset id (see remotion/templates/listicle). */
export const DEFAULT_LISTICLE_TEMPLATE_ID = "black-board";

export const emptyProjectConfig = (): ProjectConfig => ({
  arolls: [],
  edits: [],
  captions: { templateId: DEFAULT_CAPTION_TEMPLATE_ID },
  listicleStyle: { templateId: DEFAULT_LISTICLE_TEMPLATE_ID },
  defaultBRollSfxAssetId: null,
});

const templateStyleSchema = z.object({
  templateId: z.string().min(1),
  overrides: z.record(z.unknown()).optional(),
});

const arollKeepSchema = z.object({
  assetId: z.string().min(1),
  start: z.number(),
  end: z.number(),
});

const editBaseSchema = z.object({
  id: z.number().int().nonnegative(),
  start: z.number(),
  end: z.number(),
});

const zoomEditSchema = editBaseSchema
  .merge(
    z.object({
      scale: z.number().default(1.1),
      offsetX: z.number().default(0),
      offsetY: z.number().default(0),
      rotation: z.number().default(0),
    }),
  )
  .extend({
    kind: z.literal("zoom"),
    ease: z.boolean().optional(),
  });

const vfxTextEditSchema = editBaseSchema.extend({
  kind: z.literal("vfx"),
  type: z.literal("text"),
  text: z.string(),
  style: templateStyleSchema.optional(),
});

const vfxQuoteEditSchema = editBaseSchema.extend({
  kind: z.literal("vfx"),
  type: z.literal("quote"),
  style: templateStyleSchema.optional(),
});

const vfxListicleEditSchema = editBaseSchema.extend({
  kind: z.literal("vfx"),
  type: z.literal("listicle"),
  middle: z
    .number()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  indicatorText: z.string(),
  valueText: z.string(),
  hideCaptions: z.boolean().default(true),
});

const transformSchema = z.object({
  scale: z.number(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
});

const mediaRefSchema = z.object({
  assetId: z.string().min(1),
  mediaOffsetSec: z.number(),
  volume: z.number(),
});

const brollEditSchema = editBaseSchema
  .merge(transformSchema)
  .merge(mediaRefSchema)
  .extend({
    kind: z.literal("broll"),
    kenBurns: z.number().optional(),
  });

const sfxEditSchema = editBaseSchema
  .merge(mediaRefSchema)
  .extend({
    kind: z.literal("sfx"),
  });

export const projectConfigSchema = z.object({
  arolls: z.array(arollKeepSchema),
  edits: z.array(
    z.union([
      zoomEditSchema,
      vfxTextEditSchema,
      vfxQuoteEditSchema,
      vfxListicleEditSchema,
      brollEditSchema,
      sfxEditSchema,
    ]),
  ),
  captions: templateStyleSchema,
  listicleStyle: templateStyleSchema.default({
    templateId: DEFAULT_LISTICLE_TEMPLATE_ID,
  }),
  defaultBRollSfxAssetId: z.string().min(1).nullable().default(null),
});

export function parseProjectConfig(value: unknown): ProjectConfig {
  return projectConfigSchema.parse(value);
}

export function nextEditId(edits: readonly Pick<EditBase, "id">[]): EditId {
  let max = 0;
  for (const edit of edits) {
    if (edit.id > max) max = edit.id;
  }
  return max + 1;
}

/** Compacted output duration (sum of keep lengths — Remotion / export). */
export function outputDurationFromArolls(arolls: readonly ArollKeep[]): number {
  return arolls.reduce((sum, keep) => sum + Math.max(0, keep.end - keep.start), 0);
}

export const DEFAULT_TEXT_TEMPLATE_ID = "white-board";

export function seedTitleTextVfx(options: {
  edits: Edit[];
  title: string;
  /** Timeline start of the first keep (not 0 when a leading gap exists). */
  startSec: number;
  /** Expanded timeline duration (gaps count). */
  timelineDurationSec: number;
}): VfxTextEdit {
  const start = Math.max(0, options.startSec);
  const remaining = Math.max(0, options.timelineDurationSec - start);
  const duration = Math.min(DEFAULT_TEXT_VFX_DURATION_SEC, remaining);
  return {
    id: nextEditId(options.edits),
    kind: "vfx",
    type: "text",
    start,
    end: start + (duration > 0 ? duration : DEFAULT_TEXT_VFX_DURATION_SEC),
    text: options.title,
    style: { templateId: DEFAULT_TEXT_TEMPLATE_ID },
  };
}
