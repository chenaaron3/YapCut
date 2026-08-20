import type { ScribbleId } from "~/domain/transcript/scribble";
import type { TimelineTime } from "~/domain/media/time";

/** One timed token on an asset’s local timeline (seconds). */
export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
  /** Caption highlight; omit/false = not emphasized. */
  emphasized?: boolean;
  /** Draw-on mark; paints only when `emphasized`. Omit = none. */
  scribble?: ScribbleId;
};

export type TranscriptStatus = "pending" | "ready" | "failed";

/**
 * Word projected onto the expanded timeline (gaps count).
 * `start` / `end` are timeline seconds (same axis as Edits + View).
 */
export type GlobalTranscriptWord = TimelineTime & {
  text: string;
  emphasized?: boolean;
  scribble?: ScribbleId;
  assetId: string;
  /** Index into that asset’s local `words[]`. */
  localIndex: number;
  /** Index in the flat projected word list. */
  globalIndex: number;
  /** True when the word falls in a deleted (gap) layout cell — still shown on the timeline. */
  inGap?: boolean;
};
