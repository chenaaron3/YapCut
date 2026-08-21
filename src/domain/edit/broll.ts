import { TRANSFORM_DEFAULTS } from "~/domain/edit/transform";
import { DEFAULT_MEDIA_VOLUME } from "~/domain/media/media";
import { type BrollEdit } from "~/domain/project/project-config";

import type { EditSeed } from "~/domain/edit/edits";

export const BROLL_GENERATE_MAX_PROMPT = 2000;

export const BROLL_IMAGE_SIZE_LABELS = {
  portrait: "9:16",
  square: "1:1",
  landscape: "16:9",
} as const;

export const DEFAULT_KEN_BURNS = 1.15;
export const KEN_BURNS_MIN = 0.5;
export const KEN_BURNS_MAX = 2;

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const BROLL_DRAG_MIME = "application/x-broll-asset";

/** Payload for drag-from-Assets → transcript place. */
export type BrollDragPayload = {
  assetId: string;
  width: number;
  height: number;
  durationSec: number | null;
  label: string;
  kind: "image" | "video";
};

export function clampKenBurns(multiplier: number): number {
  return Math.min(KEN_BURNS_MAX, Math.max(KEN_BURNS_MIN, multiplier));
}

/** `null` turns Ken Burns off (`kenBurns` cleared). */
export function withBrollKenBurns(
  edit: BrollEdit,
  kenBurns: number | null,
): BrollEdit {
  if (kenBurns == null) {
    const rest = { ...edit };
    delete rest.kenBurns;
    return rest;
  }
  return { ...edit, kenBurns: clampKenBurns(kenBurns) };
}

export function isBrollActiveAt(
  edit: Pick<BrollEdit, "start" | "end">,
  timelineSec: number,
): boolean {
  return timelineSec >= edit.start && timelineSec < edit.end;
}

/** Place-time defaults for a b-roll edit (range filled by `placeEdit`). */
export function brollSeed(
  assetId: string,
  opts?: { mediaOffsetSec?: number },
): Extract<EditSeed, { kind: "broll" }> {
  return {
    kind: "broll",
    assetId,
    ...TRANSFORM_DEFAULTS,
    mediaOffsetSec: opts?.mediaOffsetSec ?? 0,
    volume: DEFAULT_MEDIA_VOLUME,
  };
}
