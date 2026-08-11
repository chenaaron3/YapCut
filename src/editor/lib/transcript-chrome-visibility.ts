import type { EditChromeKey } from "~/editor/lib/edit-chrome";

/** Transcript-only chrome filter groups (timeline / player unaffected). */
export type TranscriptChromeGroup = "broll" | "vfx" | "sfx" | "zoom";

export const TRANSCRIPT_CHROME_GROUPS: readonly TranscriptChromeGroup[] = [
  "broll",
  "vfx",
  "sfx",
  "zoom",
] as const;

export type TranscriptChromeVisibility = Record<TranscriptChromeGroup, boolean>;

export const DEFAULT_TRANSCRIPT_CHROME_VISIBILITY: TranscriptChromeVisibility = {
  broll: true,
  vfx: true,
  sfx: true,
  zoom: true,
};

export function chromeGroupForKey(key: EditChromeKey): TranscriptChromeGroup {
  if (key === "broll") return "broll";
  if (key === "sfx") return "sfx";
  if (key === "zoom") return "zoom";
  return "vfx";
}

export function isChromeKeyVisible(
  key: EditChromeKey,
  visible: TranscriptChromeVisibility,
): boolean {
  return visible[chromeGroupForKey(key)];
}
