import { buildArollLayoutFromAssets } from "~/domain/aroll/arolls";
import { BROLL_DRAG_MIME, brollSeed } from "~/domain/edit/broll";
import { listicleSeedFromWords } from "~/domain/vfx/listicle";
import { overlayTemplateStyle } from "~/domain/project/project-config";
import { SFX_DRAG_MIME, sfxSeed } from "~/domain/edit/sfx";
import {
  STICKER_DRAG_MIME,
  stickerEntry,
  stickerSeed,
} from "~/domain/edit/sticker";
import {
  isTransitionTemplateId,
  rangeForStitch,
  TRANSITION_DRAG_MIME,
  transitionAtStitch,
  transitionSeedFromWord,
} from "~/domain/edit/transition";
import { VFX_DRAG_MIME, vfxSeedFromPreset } from "~/domain/edit/vfx";
import { wordActionRange } from "~/editor/lib/word/word-selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

import type { BrollDragPayload } from "~/domain/edit/broll";
import type { EditSeed } from "~/domain/edit/edits";
import type { SfxDragPayload } from "~/domain/edit/sfx";
import type { StickerDragPayload } from "~/domain/edit/sticker";
import type { VfxDragPayload } from "~/domain/edit/vfx";

export type AssetDropKind = "broll" | "sfx" | "vfx" | "transition" | "sticker";

type PlaceEditOnWord = (
  globalIndex: number,
  seed: EditSeed,
  options?: { maxDurationSec?: number | null; minDurationSec?: number },
) => void;

type PlaceDrop = {
  dataTransfer: DataTransfer;
  globalIndex: number;
  placeEditOnWord: PlaceEditOnWord;
};

/** Which asset drag type is over the word, if any. */
export function assetDropKindFromTypes(
  types: readonly string[],
): AssetDropKind | null {
  if (types.includes(BROLL_DRAG_MIME)) return "broll";
  if (types.includes(STICKER_DRAG_MIME)) return "sticker";
  if (types.includes(SFX_DRAG_MIME)) return "sfx";
  if (types.includes(VFX_DRAG_MIME)) return "vfx";
  if (types.includes(TRANSITION_DRAG_MIME)) return "transition";
  return null;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function mimeRaw(dataTransfer: DataTransfer, mime: string): string | null {
  const raw = dataTransfer.getData(mime);
  return raw ? raw : null;
}

function placeStickerFromDrop({
  dataTransfer,
  globalIndex,
  placeEditOnWord,
}: PlaceDrop): boolean {
  const raw = mimeRaw(dataTransfer, STICKER_DRAG_MIME);
  if (!raw) return false;
  const payload = parseJson<StickerDragPayload>(raw);
  if (
    payload?.source &&
    payload.catalogId &&
    stickerEntry(payload.source, payload.catalogId)
  ) {
    placeEditOnWord(
      globalIndex,
      stickerSeed(payload.source, payload.catalogId),
    );
  }
  return true;
}

function placeBrollFromDrop({
  dataTransfer,
  globalIndex,
  placeEditOnWord,
}: PlaceDrop): boolean {
  const raw = mimeRaw(dataTransfer, BROLL_DRAG_MIME);
  if (!raw) return false;
  const payload = parseJson<BrollDragPayload>(raw);
  if (payload?.assetId) {
    placeEditOnWord(globalIndex, brollSeed(payload.assetId), {
      maxDurationSec: payload.durationSec,
    });
  }
  return true;
}

function placeSfxFromDrop({
  dataTransfer,
  globalIndex,
  placeEditOnWord,
}: PlaceDrop): boolean {
  const raw = mimeRaw(dataTransfer, SFX_DRAG_MIME);
  if (!raw) return false;
  const payload = parseJson<SfxDragPayload>(raw);
  if (payload?.assetId) {
    placeEditOnWord(globalIndex, sfxSeed(payload.assetId), {
      maxDurationSec: payload.durationSec,
    });
  }
  return true;
}

function placeListicleFromDrop(
  globalIndex: number,
  placeEditOnWord: PlaceEditOnWord,
): void {
  const words = useEditor.getState().getGlobalWords();
  const word = words[globalIndex];
  if (!word) return;
  const range = wordActionRange(useSelection.getState().selection, word, words);
  placeEditOnWord(
    globalIndex,
    listicleSeedFromWords(
      words,
      range,
      useEditor.getState().config?.listicleStyle ?? overlayTemplateStyle(),
    ),
  );
}

function placeVfxFromDrop({
  dataTransfer,
  globalIndex,
  placeEditOnWord,
}: PlaceDrop): boolean {
  const raw = mimeRaw(dataTransfer, VFX_DRAG_MIME);
  if (!raw) return false;
  const payload = parseJson<VfxDragPayload>(raw);
  if (payload?.type === "listicle") {
    placeListicleFromDrop(globalIndex, placeEditOnWord);
    return true;
  }
  if (
    payload?.type === "quote" ||
    payload?.type === "text" ||
    payload?.type === "shake" ||
    payload?.type === "motion"
  ) {
    placeEditOnWord(globalIndex, vfxSeedFromPreset(payload.type));
  }
  return true;
}

function placeTransitionFromDrop({
  dataTransfer,
  globalIndex,
}: PlaceDrop): boolean {
  const raw = mimeRaw(dataTransfer, TRANSITION_DRAG_MIME);
  if (!raw) return false;
  const payload = parseJson<{ templateId: string }>(raw);
  if (!payload?.templateId || !isTransitionTemplateId(payload.templateId)) {
    return true;
  }
  const editor = useEditor.getState();
  const config = editor.config;
  if (!config) return true;
  const words = editor.getGlobalWords();
  const layout = buildArollLayoutFromAssets(config.arolls, editor.assets);
  const seed = transitionSeedFromWord(
    payload.templateId,
    globalIndex,
    words,
    layout,
  );
  if (!seed) return true;
  const existing = transitionAtStitch(config.edits, seed.stitch);
  if (existing) {
    editor.patchEdit(existing.id, { templateId: seed.templateId });
    return true;
  }
  const range = rangeForStitch(seed.stitch, seed.durationSec, layout);
  if (!range) return true;
  editor.placeEditOnRange(seed, range);
  return true;
}

/**
 * Place a b-roll/sticker/SFX/VFX/transition edit from a transcript word drop.
 * Returns true when the event was handled (caller should preventDefault).
 */
export function placeEditFromAssetDrop(
  dataTransfer: DataTransfer,
  globalIndex: number,
  placeEditOnWord: PlaceEditOnWord,
): boolean {
  const drop: PlaceDrop = { dataTransfer, globalIndex, placeEditOnWord };
  return (
    placeBrollFromDrop(drop) ||
    placeStickerFromDrop(drop) ||
    placeSfxFromDrop(drop) ||
    placeVfxFromDrop(drop) ||
    placeTransitionFromDrop(drop)
  );
}
