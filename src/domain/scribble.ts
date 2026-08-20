/** Optional draw-on mark on a Transcript word. Omit = none. */

export const SCRIBBLE_IDS = [
  "double-underline",
  "wavy-underline",
  "double-circle",
  "corner-box",
  "bubble",
  "highlight",
  "strike-through",
] as const;

export type ScribbleId = (typeof SCRIBBLE_IDS)[number];

export const SCRIBBLE_LABELS: Record<ScribbleId, string> = {
  "double-underline": "Double underline",
  "wavy-underline": "Wavy underline",
  "double-circle": "Double circle",
  "corner-box": "Corner box",
  bubble: "Bubble",
  highlight: "Highlight",
  "strike-through": "Strike-through",
};

const SCRIBBLE_ID_SET = new Set<string>(SCRIBBLE_IDS);

export function isScribbleId(value: string): value is ScribbleId {
  return SCRIBBLE_ID_SET.has(value);
}

/** Paint only when the word is emphasized and has a scribble id. */
export function paintsScribble(word: {
  emphasized?: boolean;
  scribble?: ScribbleId;
}): word is { emphasized: true; scribble: ScribbleId } {
  return Boolean(word.emphasized && word.scribble);
}

/** Sparse word fields copied through projection / caption grouping. */
export function scribbleWordFields(word: {
  emphasized?: boolean;
  scribble?: ScribbleId;
}): { emphasized?: true; scribble?: ScribbleId } {
  return {
    ...(word.emphasized ? { emphasized: true as const } : {}),
    ...(word.scribble ? { scribble: word.scribble } : {}),
  };
}
