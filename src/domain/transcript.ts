import type { TimelineTime } from "~/domain/time";

/** One timed token on an asset’s local timeline (seconds). */
export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
  /** Caption highlight; omit/false = not emphasized. */
  emphasized?: boolean;
};

export type TranscriptStatus = "pending" | "ready" | "failed";

/**
 * Word projected onto the expanded timeline (gaps count).
 * `start` / `end` are timeline seconds (same axis as Edits + View).
 */
export type GlobalTranscriptWord = TimelineTime & {
  text: string;
  emphasized?: boolean;
  assetId: string;
  /** Index into that asset’s local `words[]`. */
  localIndex: number;
  /** Index in the flat projected word list. */
  globalIndex: number;
};
