import {
  COMPANION_SFX_VOLUME,
  SFX_VOLUME_DEFAULT,
} from "~/domain/audio/mix-levels";
import type { EditSeed } from "~/domain/edits";
import type { MediaRef } from "~/domain/project-config";

export { COMPANION_SFX_VOLUME, SFX_VOLUME_DEFAULT };

/** Official `public/sfx/<folder>/` pools (not `custom/`). */
export const SFX_FOLDER_ORDER = [
  "reveal",
  "tick",
  "ping",
  "motion",
] as const;
export type SfxFolder = (typeof SFX_FOLDER_ORDER)[number];

const OFFICIAL_FOLDER_SET = new Set<string>(SFX_FOLDER_ORDER);

export const SFX_FOLDER_LABELS: Record<SfxFolder, string> = {
  reveal: "Reveal",
  tick: "Tick",
  ping: "Ping",
  motion: "Motion",
};

export function sfxFolderLabel(folder: string): string {
  if (OFFICIAL_FOLDER_SET.has(folder)) {
    return SFX_FOLDER_LABELS[folder as SfxFolder];
  }
  return folder;
}

/**
 * Group key from a seeded relative path.
 * `motion/whoosh.wav` → `motion`; `custom/general/x.wav` → `general`.
 */
export function sfxFolderOf(
  originalFilename: string | null | undefined,
): string | null {
  if (!originalFilename) return null;
  const parts = originalFilename.split(/[/\\]/);
  if (parts[0] === "custom" && parts.length >= 3) {
    return parts[1] ?? null;
  }
  return parts.length >= 2 ? (parts[0] ?? null) : null;
}

/** Parse `reveal/foo.wav` → official folder; ignore `custom/…` and unknown. */
export function parseOfficialSfxPath(
  relativePath: string,
): { folder: SfxFolder } | null {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const parts = cleaned.split("/");
  if (parts.length !== 2) return null;
  const [folder, file] = parts;
  if (!folder || !file || file.includes("..")) return null;
  if (!OFFICIAL_FOLDER_SET.has(folder)) return null;
  return { folder: folder as SfxFolder };
}

export function expectedSfxPoolDirs(): string[] {
  return [...SFX_FOLDER_ORDER];
}

/** Stable hash → index into a sorted pool. */
export function pickSfxAssetId(
  poolAssetIds: readonly string[],
  seedKey: string,
): string | null {
  if (poolAssetIds.length === 0) return null;
  const sorted = [...poolAssetIds].sort();
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % sorted.length;
  return sorted[idx] ?? null;
}

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const SFX_DRAG_MIME = "application/x-sfx-asset";

/** Payload for drag-from-Assets → transcript place. */
export type SfxDragPayload = {
  assetId: string;
  durationSec: number | null;
  label: string;
};

export const DEFAULT_SFX_VOLUME = SFX_VOLUME_DEFAULT;

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
export function sfxSeed(
  assetId: string,
  volume: number = DEFAULT_SFX_VOLUME,
): Extract<EditSeed, { kind: "sfx" }> {
  return {
    kind: "sfx",
    assetId,
    mediaOffsetSec: 0,
    volume,
  };
}

/** Nested companion on a visual edit (70% mix, offset 0). */
export function companionSfxRef(assetId: string): MediaRef {
  return {
    assetId,
    mediaOffsetSec: 0,
    volume: COMPANION_SFX_VOLUME,
  };
}
