import {
  BROLL_DRAG_MIME,
  brollSeed,
  type BrollDragPayload,
} from "~/domain/broll";
import type { EditSeed } from "~/domain/edits";
import { listicleSeedFromWords } from "~/domain/listicle";
import {
  SFX_DRAG_MIME,
  sfxSeed,
  type SfxDragPayload,
} from "~/domain/sfx";
import {
  VFX_DRAG_MIME,
  vfxSeedFromPreset,
  type VfxDragPayload,
} from "~/domain/vfx";
import { wordActionRange } from "~/editor/lib/word-selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

export type AssetDropKind = "broll" | "sfx" | "vfx";

type PlaceEditOnWord = (
  globalIndex: number,
  seed: EditSeed,
  options?: { maxDurationSec?: number | null },
) => void;

/** Which asset drag type is over the word, if any. */
export function assetDropKindFromTypes(
  types: readonly string[],
): AssetDropKind | null {
  if (types.includes(BROLL_DRAG_MIME)) return "broll";
  if (types.includes(SFX_DRAG_MIME)) return "sfx";
  if (types.includes(VFX_DRAG_MIME)) return "vfx";
  return null;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Place a b-roll/SFX/VFX edit from a transcript word drop.
 * Returns true when the event was handled (caller should preventDefault).
 */
export function placeEditFromAssetDrop(
  dataTransfer: DataTransfer,
  globalIndex: number,
  placeEditOnWord: PlaceEditOnWord,
): boolean {
  const brollRaw = dataTransfer.getData(BROLL_DRAG_MIME);
  if (brollRaw) {
    const payload = parseJson<BrollDragPayload>(brollRaw);
    if (payload?.assetId) {
      placeEditOnWord(globalIndex, brollSeed(payload.assetId), {
        maxDurationSec: payload.durationSec,
      });
    }
    return true;
  }

  const sfxRaw = dataTransfer.getData(SFX_DRAG_MIME);
  if (sfxRaw) {
    const payload = parseJson<SfxDragPayload>(sfxRaw);
    if (payload?.assetId) {
      placeEditOnWord(globalIndex, sfxSeed(payload.assetId), {
        maxDurationSec: payload.durationSec,
      });
    }
    return true;
  }

  const vfxRaw = dataTransfer.getData(VFX_DRAG_MIME);
  if (!vfxRaw) return false;
  const payload = parseJson<VfxDragPayload>(vfxRaw);
  if (payload?.type === "listicle") {
    const words = useEditor.getState().getGlobalWords();
    const word = words[globalIndex];
    if (!word) return true;
    const range = wordActionRange(
      useSelection.getState().selection,
      word,
      words,
    );
    placeEditOnWord(globalIndex, listicleSeedFromWords(words, range));
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
