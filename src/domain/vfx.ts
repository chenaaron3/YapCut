import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextBaseEdit,
  nextEditId,
  overlayMidpointSec,
} from "~/domain/project-config";
import { quoteSeed } from "~/domain/quote";
import { shakeSeed } from "~/domain/shake";
import { OVERLAY_TRANSFORM_DEFAULTS } from "~/domain/transform";

import type { EditSeed } from "~/domain/edits";
import type { Edit, VfxTextEdit } from "~/domain/project-config";

/** Default timeline span for a seeded title text VFX. */
export const DEFAULT_TEXT_VFX_DURATION_SEC = 5;

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const VFX_DRAG_MIME = "application/x-vfx-preset";

export type VfxPresetType = "quote" | "text" | "listicle" | "shake";

/** Payload for drag-from-Assets → transcript place. */
export type VfxDragPayload = {
  type: VfxPresetType;
  label: string;
};

/** Drag payloads from the VFX tab (presets, not baked files). */
export const VFX_PRESETS: readonly VfxDragPayload[] = [
  { type: "quote", label: "Quote" },
  { type: "text", label: "Text" },
  { type: "listicle", label: "Listicle" },
  { type: "shake", label: "Shake" },
] as const;

/** Place-time defaults for a text VFX (range filled by `placeEdit`). */
export function textSeed(): Extract<EditSeed, { kind: "vfx"; type: "text" }> {
  return {
    kind: "vfx",
    type: "text",
    heading: "",
    subheading: "",
    middle: null,
    hideCaptions: false,
    ...OVERLAY_TRANSFORM_DEFAULTS,
    style: { templateId: DEFAULT_TEXT_TEMPLATE_ID },
  };
}

/** Create-flow title card: full `vfx/text` Edit from Project.title. */
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
    ...textSeed(),
    start,
    end: start + (duration > 0 ? duration : DEFAULT_TEXT_VFX_DURATION_SEC),
    heading: options.title,
  };
}

/** Place-time seed for quote/text/shake presets (listicle → `listicleSeedFromWords`). */
export function vfxSeedFromPreset(
  type: Exclude<VfxPresetType, "listicle">,
): Extract<EditSeed, { kind: "vfx" }> {
  if (type === "quote") return quoteSeed();
  if (type === "shake") return shakeSeed();
  return textSeed();
}

/**
 * Timeline sec of the stagger split, or null if this edit has none.
 * Serial + subheading with unset `middle` uses a virtual midpoint.
 */
export function editMiddleSec(edit: Edit, stacked: boolean): number | null {
  if (!isTextBaseEdit(edit)) return null;
  if (!edit.subheading.trim()) return null;
  if (typeof edit.middle === "number") return edit.middle;
  if (!stacked) return overlayMidpointSec(edit.start, edit.end);
  return null;
}
