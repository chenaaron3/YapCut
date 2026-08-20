/**
 * Shared time-range shapes (seconds). Same fields, different clocks — do not mix.
 *
 * - LocalTime — one Asset’s media timeline (+ assetId)
 * - TimelineTime — expanded project axis (gaps count); Edits + View
 * - OutputTime — compacted playback/export axis (Remotion)
 */

export type TimelineTime = {
  start: number;
  end: number;
};

/** Compacted output range (keeps only). Same shape as TimelineTime; different clock. */
export type OutputTime = {
  start: number;
  end: number;
};

/** Range on a single Asset’s media timeline. */
export type LocalTime = {
  assetId: string;
  start: number;
  end: number;
};
