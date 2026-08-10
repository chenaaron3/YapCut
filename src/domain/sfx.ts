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

/**
 * Display label for an SFX asset path.
 * `reveal/soft/title-enter.wav` → `Title Enter`
 */
export function formatSfxLabel(
  originalFilename: string | null | undefined,
  fallbackId?: string,
): string {
  if (!originalFilename) {
    return fallbackId ? fallbackId.slice(0, 8) : "SFX";
  }
  const base =
    originalFilename.split(/[/\\]/).pop() ?? originalFilename;
  const stem = base.replace(/\.[^.]+$/, "");
  const words = stem
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) {
    return fallbackId ? fallbackId.slice(0, 8) : "SFX";
  }
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Place-time defaults for an SFX edit (range filled by `placeEdit`). */
export function sfxSeed(assetId: string): Extract<EditSeed, { kind: "sfx" }> {
  return {
    kind: "sfx",
    assetId,
    mediaOffsetSec: 0,
    volume: DEFAULT_SFX_VOLUME,
  };
}
