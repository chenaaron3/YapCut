import { buildArollLayoutFromAssets } from "~/domain/arolls";
import { BROLL_DRAG_MIME, brollSeed } from "~/domain/broll";
import { listicleSeedFromWords } from "~/domain/listicle";
import { DEFAULT_LISTICLE_TEMPLATE_ID } from "~/domain/project-config";
import { SFX_DRAG_MIME, sfxSeed } from "~/domain/sfx";
import {
  TRANSITION_DRAG_MIME,
  isTransitionTemplateId,
  rangeForStitch,
  transitionAtStitch,
  transitionSeedFromWord,
} from "~/domain/transition";
import { VFX_DRAG_MIME, vfxSeedFromPreset } from "~/domain/vfx";
import { wordActionRange } from "~/editor/lib/word-selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

import type { BrollDragPayload } from "~/domain/broll";
import type { EditSeed } from "~/domain/edits";
import type { SfxDragPayload } from "~/domain/sfx";
import type { VfxDragPayload } from "~/domain/vfx";

export type AssetDropKind = "broll" | "sfx" | "vfx" | "transition";

type PlaceEditOnWord = (
  globalIndex: number,
  seed: EditSeed,
  options?: { maxDurationSec?: number | null },
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
  const range = wordActionRange(
    useSelection.getState().selection,
    word,
    words,
  );
  placeEditOnWord(
    globalIndex,
    listicleSeedFromWords(
      words,
      range,
      useEditor.getState().config?.listicleStyle ?? {
        templateId: DEFAULT_LISTICLE_TEMPLATE_ID,
      },
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
    payload?.type === "shake"
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
 * Place a b-roll/SFX/VFX/transition edit from a transcript word drop.
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
    placeSfxFromDrop(drop) ||
    placeVfxFromDrop(drop) ||
    placeTransitionFromDrop(drop)
  );
}
