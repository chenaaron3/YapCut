import type { EditSeed } from "~/domain/edits";
import { DEFAULT_TEXT_TEMPLATE_ID } from "~/domain/project-config";
import { quoteSeed } from "~/domain/quote";

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const VFX_DRAG_MIME = "application/x-vfx-preset";

export type VfxPresetType = "quote" | "text";

/** Payload for drag-from-Assets → transcript place. */
export type VfxDragPayload = {
  type: VfxPresetType;
  label: string;
};

/** Drag payloads from the VFX tab (presets, not baked files). */
export const VFX_PRESETS: readonly VfxDragPayload[] = [
  { type: "quote", label: "Quote" },
  { type: "text", label: "Text" },
] as const;

/** Place-time defaults for a text VFX (range filled by `placeEdit`). */
export function textSeed(): Extract<
  EditSeed,
  { kind: "vfx"; type: "text" }
> {
  return {
    kind: "vfx",
    type: "text",
    text: "",
    style: { templateId: DEFAULT_TEXT_TEMPLATE_ID },
  };
}

/** Place-time seed for a VFX preset. */
export function vfxSeedFromPreset(
  type: VfxPresetType,
): Extract<EditSeed, { kind: "vfx" }> {
  if (type === "quote") return quoteSeed();
  return textSeed();
}
