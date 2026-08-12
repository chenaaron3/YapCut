import type { EditChromeKey } from "~/editor/lib/edit-chrome";
import { EDIT_CHROME } from "~/editor/lib/edit-chrome";

/** Transcript-only chrome filter groups — one per edit chrome key. */
export type TranscriptChromeGroup = EditChromeKey;

export const TRANSCRIPT_CHROME_GROUPS: readonly TranscriptChromeGroup[] =
  EDIT_CHROME.map((s) => s.key);

export type TranscriptChromeVisibility = Record<TranscriptChromeGroup, boolean>;

export const DEFAULT_TRANSCRIPT_CHROME_VISIBILITY: TranscriptChromeVisibility =
  Object.fromEntries(TRANSCRIPT_CHROME_GROUPS.map((g) => [g, true])) as TranscriptChromeVisibility;

export function chromeGroupForKey(key: EditChromeKey): TranscriptChromeGroup {
  return key;
}

export function isChromeKeyVisible(
  key: EditChromeKey,
  visible: TranscriptChromeVisibility,
): boolean {
  return visible[key];
}
