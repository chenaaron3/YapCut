import { z } from "zod";

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

export type ZoomEdit = EditBase & {
  kind: "zoom";
  scale?: number;
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

export type BrollEdit = EditBase & {
  kind: "broll";
  assetId: string;
};

export type SfxEdit = EditBase & {
  kind: "sfx";
  assetId: string;
};

export type VfxEdit = VfxTextEdit | VfxQuoteEdit;

export type Edit = BrollEdit | SfxEdit | ZoomEdit | VfxEdit;

export type ProjectConfig = {
  arolls: ArollKeep[];
  edits: Edit[];
  captions: TemplateStyle;
};

export const DEFAULT_CAPTION_TEMPLATE_ID = "hormozi";
export const DEFAULT_TEXT_VFX_DURATION_SEC = 5;
/** Output fps used for min-keep filtering (matches Remotion composition). */
export const PROJECT_FPS = 30;

export const emptyProjectConfig = (): ProjectConfig => ({
  arolls: [],
  edits: [],
  captions: { templateId: DEFAULT_CAPTION_TEMPLATE_ID },
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

const zoomEditSchema = editBaseSchema.extend({
  kind: z.literal("zoom"),
  scale: z.number().optional(),
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

const brollEditSchema = editBaseSchema.extend({
  kind: z.literal("broll"),
  assetId: z.string().min(1),
});

const sfxEditSchema = editBaseSchema.extend({
  kind: z.literal("sfx"),
  assetId: z.string().min(1),
});

export const projectConfigSchema = z.object({
  arolls: z.array(arollKeepSchema),
  edits: z.array(
    z.union([
      zoomEditSchema,
      vfxTextEditSchema,
      vfxQuoteEditSchema,
      brollEditSchema,
      sfxEditSchema,
    ]),
  ),
  captions: templateStyleSchema,
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
  /** Expanded timeline duration (gaps count). */
  timelineDurationSec: number;
}): VfxTextEdit {
  const end = Math.min(
    DEFAULT_TEXT_VFX_DURATION_SEC,
    Math.max(0, options.timelineDurationSec),
  );
  return {
    id: nextEditId(options.edits),
    kind: "vfx",
    type: "text",
    start: 0,
    end: end > 0 ? end : DEFAULT_TEXT_VFX_DURATION_SEC,
    text: options.title,
    style: { templateId: DEFAULT_TEXT_TEMPLATE_ID },
  };
}
