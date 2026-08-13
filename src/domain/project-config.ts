import { z } from "zod";

import { MUSIC_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import {
  emphasisStyleSchema,
  optionalEmphasisStyleSchema,
  type EmphasisStyle,
} from "~/domain/emphasis-style";
import type { LocalTime, TimelineTime } from "~/domain/time";

export type { EmphasisStyle };

/** Catalog base + sparse user overrides. Overlay adds a subheading bag. */
export type TemplateStyle = {
  templateId: string;
  /** Captions/quotes: the look. Overlay: heading tab. */
  overrides?: Record<string, unknown>;
  /** Overlay subheading tab. Captions/quotes ignore. */
  subheadingOverrides?: Record<string, unknown>;
};

/** Copy bags so fan-out does not share object identity. */
export function cloneTemplateStyle(style: TemplateStyle): TemplateStyle {
  return {
    templateId: style.templateId,
    ...(style.overrides ? { overrides: { ...style.overrides } } : {}),
    ...(style.subheadingOverrides
      ? { subheadingOverrides: { ...style.subheadingOverrides } }
      : {}),
  };
}

/**
 * Merge a partial patch onto a TemplateStyle.
 * `"overrides" in patch` / `"subheadingOverrides" in patch` can clear a bag.
 */
export function applyTemplateStylePatch(
  current: TemplateStyle,
  patch: Partial<TemplateStyle>,
): TemplateStyle {
  return cloneTemplateStyle({
    templateId: patch.templateId ?? current.templateId,
    overrides: "overrides" in patch ? patch.overrides : current.overrides,
    subheadingOverrides:
      "subheadingOverrides" in patch
        ? patch.subheadingOverrides
        : current.subheadingOverrides,
  });
}

/** One keep segment on an A-roll asset (local seconds). */
export type ArollKeep = LocalTime;

export type EditId = number;

/** Shared fields on every Edit (expanded timeline seconds — gaps count). */
export type EditBase = TimelineTime & {
  id: EditId;
};

/**
 * Mixin for edits that can suppress spoken captions under their timeline range.
 * Title and listicle opt in via `TextBase.hideCaptions` (seeded true).
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

/**
 * Shared copy + block pose for title and listicle overlays.
 * `subheading` empty = heading only. `middle` null = no split (stacked
 * templates); serial templates always stagger (virtual midpoint if unset).
 * `style` is the overlay look — title owns it; listicle mirrors Project.listicleStyle.
 */
export type TextBase = Transform &
  CanHideCaptions & {
    heading: string;
    subheading: string;
    middle: number | null;
    style: TemplateStyle;
  };

export type VfxTextEdit = EditBase &
  TextBase & {
    kind: "vfx";
    type: "text";
  };

export type VfxQuoteEdit = EditBase & {
  kind: "vfx";
  type: "quote";
  style?: TemplateStyle;
  /**
   * Sparse merge over project `emphasisStyle` for emphasized words in this quote.
   * Omit / `{}` = use project only.
   */
  emphasisStyle?: EmphasisStyle;
};

/** Listicle overlay — `style` mirrors Project.listicleStyle (fan-out on patch). */
export type VfxListicleEdit = EditBase &
  TextBase & {
    kind: "vfx";
    type: "listicle";
  };

/**
 * Camera shake VFX — amplitude as a fraction of composition size.
 * Omit `intensity` for the default (see `DEFAULT_SHAKE_INTENSITY`).
 */
export type VfxShakeEdit = EditBase & {
  kind: "vfx";
  type: "shake";
  intensity?: number;
};

/** Normalized transform applied at props / overlay time. */
export type Transform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

/**
 * Ref to a project/global Asset (src/size live on the Asset row).
 * Used by `broll` / `sfx` edits and the `music` Project field.
 */
export type MediaRef = {
  assetId: string;
  /** Trim into source media (sec). */
  mediaOffsetSec: number;
  /** Linear gain 0–1. */
  volume: number;
};

/** Looping bed for the whole output. Same media fields as an audio edit; not an Edit. */
export type MusicBed = MediaRef;

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

export type VfxEdit =
  | VfxTextEdit
  | VfxQuoteEdit
  | VfxListicleEdit
  | VfxShakeEdit;

export type Edit = BrollEdit | SfxEdit | ZoomEdit | VfxEdit;

/** Edit members that include the `TextBase` mixin. */
export type TextBaseEdit = Extract<Edit, TextBase>;

export function isTextBaseEdit(edit: Edit): edit is TextBaseEdit {
  return textBaseSchema.safeParse(edit).success;
}

const MIN_OVERLAY_PHASE_SEC = 0.05;

/** Clamp overlay `middle` so both phases keep a minimum duration. */
export function clampOverlayMiddle(
  start: number,
  middle: number,
  end: number,
  minLen = MIN_OVERLAY_PHASE_SEC,
): number {
  const lo = start + minLen;
  const hi = end - minLen;
  if (hi <= lo) return (start + end) / 2;
  return Math.min(hi, Math.max(lo, middle));
}

/** Midpoint used when a serial overlay has no persisted `middle`. */
export function overlayMidpointSec(start: number, end: number): number {
  return clampOverlayMiddle(start, (start + end) / 2, end);
}

export type ProjectConfig = {
  arolls: ArollKeep[];
  edits: Edit[];
  captions: TemplateStyle;
  /**
   * Shared listicle look (all listicle edits use this).
   * Same overlay catalog as titles; `overrides` = heading, `subheadingOverrides` = subheading.
   */
  listicleStyle: TemplateStyle;
  /**
   * Shared emphasis treatment for `emphasized` words.
   * Applied after the caption/quote group style. Quotes may replace via
   * `VfxQuoteEdit.emphasisStyle`.
   */
  emphasisStyle: EmphasisStyle;
  /**
   * Global audio Asset id placed as a sibling `sfx` edit when dropping b-roll.
   * `null` = no entrance SFX on place.
   */
  defaultBRollSfxAssetId: string | null;
  /**
   * Looping music bed for the whole output, or null when unset.
   * Not an Edit — pick from the Music tab.
   */
  music: MusicBed | null;
};

export const DEFAULT_CAPTION_TEMPLATE_ID = "ugc";
/** Titles seed this overlay look (see remotion/templates/overlay). */
export const DEFAULT_TEXT_TEMPLATE_ID = "red-teal" as const;
/** Listicles seed this overlay look (see remotion/templates/overlay). */
export const DEFAULT_LISTICLE_TEMPLATE_ID = "red-teal" as const;
/** Output fps used for min-keep filtering (matches Remotion composition). */
export const PROJECT_FPS = 30;

export const emptyProjectConfig = (): ProjectConfig => ({
  arolls: [],
  edits: [],
  captions: { templateId: DEFAULT_CAPTION_TEMPLATE_ID },
  listicleStyle: { templateId: DEFAULT_LISTICLE_TEMPLATE_ID },
  emphasisStyle: {},
  defaultBRollSfxAssetId: null,
  music: null,
});

const templateStyleSchema = z.object({
  templateId: z.string().min(1),
  overrides: z.record(z.unknown()).optional(),
  subheadingOverrides: z.record(z.unknown()).optional(),
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

const transformSchema = z.object({
  scale: z.number(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
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

const textBaseSchema = transformSchema.extend({
  heading: z.string(),
  subheading: z.string(),
  middle: z.number().nullable(),
  hideCaptions: z.boolean(),
  style: templateStyleSchema,
});

const vfxTextEditSchema = editBaseSchema.merge(textBaseSchema).extend({
  kind: z.literal("vfx"),
  type: z.literal("text"),
});

const vfxQuoteEditSchema = editBaseSchema.extend({
  kind: z.literal("vfx"),
  type: z.literal("quote"),
  style: templateStyleSchema.optional(),
  emphasisStyle: optionalEmphasisStyleSchema,
});

const vfxListicleEditSchema = editBaseSchema.merge(textBaseSchema).extend({
  kind: z.literal("vfx"),
  type: z.literal("listicle"),
});

const vfxShakeEditSchema = editBaseSchema.extend({
  kind: z.literal("vfx"),
  type: z.literal("shake"),
  intensity: z.number().optional(),
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
      vfxShakeEditSchema,
      brollEditSchema,
      sfxEditSchema,
    ]),
  ),
  captions: templateStyleSchema,
  listicleStyle: templateStyleSchema,
  emphasisStyle: emphasisStyleSchema,
  defaultBRollSfxAssetId: z.string().min(1).nullable().default(null),
  music: z
    .object({
      assetId: z.string().min(1),
      volume: z.number().default(MUSIC_VOLUME_DEFAULT),
      mediaOffsetSec: z.number().default(0),
    })
    .nullable()
    .default(null),
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
