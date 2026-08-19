import { z } from "zod";

import { MUSIC_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import {
  companionSfxMapSchema,
  defaultCompanionSfxMap,
} from "~/domain/companion-sfx-map";
import {
  DEFAULT_EMPHASIS_FONT_FAMILY,
  DEFAULT_EMPHASIS_SCALE,
  emphasisStyleSchema,
  optionalEmphasisStyleSchema,
} from "~/domain/emphasis-style";

import { shotPlanSchema } from "~/domain/motion-config";

import type { CompanionSfxMap } from "~/domain/companion-sfx-map";
import type { EmphasisStyle } from "~/domain/emphasis-style";
import type { ShotPlan } from "~/domain/motion-config";
import type { LocalTime, TimelineTime } from "~/domain/time";

export type { EmphasisStyle };
export type {
  CompanionSfxCueId,
  CompanionSfxMap,
  CompanionSfxSource,
} from "~/domain/companion-sfx-map";

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

export type KeepId = number;

/** One keep segment on an A-roll asset (local seconds). `id` is stable across trim/insert. */
export type ArollKeep = LocalTime & { id: KeepId };

export type EditId = number;

/** Shared fields on every Edit (expanded timeline seconds — gaps count). */
export type EditBase = TimelineTime & {
  id: EditId;
  /**
   * Nested entrance SFX (not an `SfxEdit`, no transcript marker).
   * Omit = none. Plays from `start` for the SFX file duration.
   */
  companionSfx?: MediaRef;
};

/**
 * Mixin for edits that can suppress spoken captions under their timeline range.
 * Title and listicle opt in via `TextBase.hideCaptions`
 * (title seeded false; listicle seeded true).
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
    "hideCaptions" in edit && (edit as CanHideCaptions).hideCaptions === true
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

/**
 * Word-synced graphic overlay. Persisted document is a ShotPlan
 * (Director form) plus caption-catalog TemplateStyle.
 */
export type VfxMotionEdit = EditBase &
  Transform &
  CanHideCaptions & {
    kind: "vfx";
    type: "motion";
    plan: ShotPlan | null;
    style: TemplateStyle;
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
  /**
   * Linear mix gain. SFX/music: 100% slider = role default, max 200% (2×).
   * B-roll: 0–1 of the file.
   */
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

export type TransitionTemplateId = "flash" | "flashZoom" | "slide";

/** Sequence role or a keep–keep stitch (keep ids, not layout indexes). */
export type TransitionStitch =
  | { kind: "opening" }
  | { kind: "closing" }
  | { kind: "interior"; outKeepId: KeepId; inKeepId: KeepId };

/**
 * A-roll picture stitch. Identity is `stitch` + `durationSec` (output seconds);
 * `start`/`end` are derived timeline range (gaps count).
 */
export type TransitionEdit = EditBase & {
  kind: "transition";
  templateId: TransitionTemplateId;
  durationSec: number;
  stitch: TransitionStitch;
};

export type VfxEdit =
  | VfxTextEdit
  | VfxQuoteEdit
  | VfxListicleEdit
  | VfxShakeEdit
  | VfxMotionEdit;

export type Edit = BrollEdit | SfxEdit | ZoomEdit | VfxEdit | TransitionEdit;

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
   * Default companion SFX pools per visual cue. Factory hash-picks at
   * create time onto `Edit.companionSfx`. `overlayMiddle` is AI-only
   * (sibling `SfxEdit` at overlay split).
   */
  companionSfx: CompanionSfxMap;
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
  emphasisStyle: {
    scale: DEFAULT_EMPHASIS_SCALE,
    fontFamily: DEFAULT_EMPHASIS_FONT_FAMILY,
  },
  companionSfx: defaultCompanionSfxMap(),
  music: null,
});

const templateStyleSchema = z.object({
  templateId: z.string().min(1),
  overrides: z.record(z.unknown()).optional(),
  subheadingOverrides: z.record(z.unknown()).optional(),
});

const arollKeepSchema = z.object({
  id: z.number().int().nonnegative(),
  assetId: z.string().min(1),
  start: z.number(),
  end: z.number(),
});

const mediaRefSchema = z.object({
  assetId: z.string().min(1),
  mediaOffsetSec: z.number(),
  volume: z.number(),
});

const editBaseSchema = z.object({
  id: z.number().int().nonnegative(),
  start: z.number(),
  end: z.number(),
  companionSfx: mediaRefSchema.optional(),
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

const vfxMotionEditSchema = editBaseSchema.merge(transformSchema).extend({
  kind: z.literal("vfx"),
  type: z.literal("motion"),
  hideCaptions: z.boolean(),
  plan: shotPlanSchema.nullable(),
  style: templateStyleSchema,
});

const brollEditSchema = editBaseSchema
  .merge(transformSchema)
  .merge(mediaRefSchema)
  .extend({
    kind: z.literal("broll"),
    kenBurns: z.number().optional(),
  });

const sfxEditSchema = editBaseSchema.merge(mediaRefSchema).extend({
  kind: z.literal("sfx"),
});

const transitionStitchSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("opening") }),
  z.object({ kind: z.literal("closing") }),
  z.object({
    kind: z.literal("interior"),
    outKeepId: z.number().int().nonnegative(),
    inKeepId: z.number().int().nonnegative(),
  }),
]);

const transitionEditSchema = editBaseSchema.extend({
  kind: z.literal("transition"),
  templateId: z
    .string()
    .transform((id) => (id === "fade" ? "flash" : id))
    .pipe(z.enum(["flash", "flashZoom", "slide"])),
  durationSec: z.number().positive(),
  stitch: transitionStitchSchema,
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
      vfxMotionEditSchema,
      brollEditSchema,
      sfxEditSchema,
      transitionEditSchema,
    ]),
  ),
  captions: templateStyleSchema,
  listicleStyle: templateStyleSchema,
  emphasisStyle: emphasisStyleSchema,
  companionSfx: companionSfxMapSchema,
  music: z
    .object({
      assetId: z.string().min(1),
      volume: z.number().default(MUSIC_VOLUME_DEFAULT),
      mediaOffsetSec: z.number().default(0),
    })
    .nullable()
    .default(null),
});

export function nextKeepId(arolls: readonly Pick<ArollKeep, "id">[]): KeepId {
  let max = 0;
  for (const keep of arolls) {
    if (keep.id > max) max = keep.id;
  }
  return max + 1;
}

/** Mint 1..n ids for a new keep list (create pipeline). */
export function assignKeepIds(arolls: readonly LocalTime[]): ArollKeep[] {
  return arolls.map((keep, i) => ({
    id: i + 1,
    assetId: keep.assetId,
    start: keep.start,
    end: keep.end,
  }));
}

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
