import type { EditSeed } from "~/domain/edits";

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const SFX_DRAG_MIME = "application/x-sfx-asset";

/** Payload for drag-from-Assets → transcript place. */
export type SfxDragPayload = {
  assetId: string;
  durationSec: number | null;
  label: string;
};

/**
 * Default linear gain for placed SFX (no loudness pack).
 * Roughly “punctuate under voice” without LUFS metadata.
 */
export const DEFAULT_SFX_VOLUME = 0.65;

/** Place-time defaults for an SFX edit (range filled by `placeEdit`). */
export function sfxSeed(assetId: string): Extract<EditSeed, { kind: "sfx" }> {
  return {
    kind: "sfx",
    assetId,
    mediaOffsetSec: 0,
    volume: DEFAULT_SFX_VOLUME,
  };
}
