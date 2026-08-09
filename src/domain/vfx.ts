import type { EditSeed } from "~/domain/edits";
import { DEFAULT_TEXT_TEMPLATE_ID } from "~/domain/project-config";
import { quoteSeed } from "~/domain/quote";

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const VFX_DRAG_MIME = "application/x-vfx-preset";

export type VfxPresetType = "quote" | "text" | "listicle";

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

/** Place-time seed for quote/text presets (listicle → `listicleSeedFromWords`). */
export function vfxSeedFromPreset(
  type: Exclude<VfxPresetType, "listicle">,
): Extract<EditSeed, { kind: "vfx" }> {
  if (type === "quote") return quoteSeed();
  return textSeed();
}
